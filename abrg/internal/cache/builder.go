package cache

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"maps"
	"time"

	duckdbdriver "github.com/duckdb/duckdb-go/v2"

	"abr.local/common/db"
	"abr.local/common/duck"

	"abrg/internal/infra/duckdb"
	"abrg/internal/schema"
	"abrg/internal/transform"
)

func Build(ctx context.Context, cachePath string) error {
	startTime := time.Now()
	phaseSec := make(map[string]float64)

	openStart := time.Now()
	conn, err := duckdb.Open(cachePath)
	if err != nil {
		return fmt.Errorf("failed to open DuckDB: %w", err)
	}
	defer func() { _ = conn.Close() }()
	phaseSec["open"] = time.Since(openStart).Seconds()

	extStart := time.Now()
	if err := duck.LoadExtension(ctx, conn, "spatial"); err != nil {
		return fmt.Errorf("failed to load spatial extension: %w", err)
	}
	phaseSec["extension"] = time.Since(extStart).Seconds()

	udfStart := time.Now()
	if err := registerUDF(ctx, conn); err != nil {
		return fmt.Errorf("register UDF: %w", err)
	}
	phaseSec["udf"] = time.Since(udfStart).Seconds()

	schemaStart := time.Now()
	if err := initSchema(ctx, conn); err != nil {
		return fmt.Errorf("failed to initialize schema: %w", err)
	}
	phaseSec["schema"] = time.Since(schemaStart).Seconds()

	loadPhaseSec, err := loadFromPostgres(ctx, conn)
	if err != nil {
		return fmt.Errorf("load from PostgreSQL: %w", err)
	}
	maps.Copy(phaseSec, loadPhaseSec)

	totalSec := time.Since(startTime).Seconds()
	slog.Debug("cache build timing",
		"event", "cache_build_timing",
		"path", cachePath,
		"total_sec", totalSec,
		"category_sec", phaseSec,
	)
	return nil
}

func registerUDF(ctx context.Context, conn *sql.DB) error {
	dbConn, err := conn.Conn(ctx)
	if err != nil {
		return fmt.Errorf("failed to get connection: %w", err)
	}
	defer func() { _ = dbConn.Close() }()

	if err := duckdbdriver.RegisterScalarUDF(dbConn, "normalize_text_go", &transform.TextForDBUDF{}); err != nil {
		return fmt.Errorf("failed to register normalize_text_go UDF: %w", err)
	}
	return nil
}

func initSchema(ctx context.Context, conn *sql.DB) error {
	sqlText, err := schema.InitSchemaSQL()
	if err != nil {
		return fmt.Errorf("failed to get init schema SQL: %w", err)
	}
	if _, err := conn.ExecContext(ctx, sqlText); err != nil {
		return fmt.Errorf("failed to execute init schema: %w", err)
	}
	return nil
}

// Category-specific tables must load before basic tables (cache_machiaza has CTEs
// that aggregate counts from category tables).
func loadFromPostgres(ctx context.Context, conn *sql.DB) (map[string]float64, error) {
	phaseSec := make(map[string]float64)

	ctx, cancel := context.WithTimeout(ctx, 900*time.Second) // Large datasets need 10+ min
	defer cancel()

	if _, err := conn.ExecContext(ctx, "SET memory_limit='8GB'"); err != nil {
		slog.Warn("failed to set memory limit", "event", "set_memory_limit", "error", err)
	}

	pgExtStart := time.Now()
	if err := duck.LoadExtension(ctx, conn, "postgres"); err != nil {
		return nil, fmt.Errorf("failed to load postgres extension: %w", err)
	}
	phaseSec["pg_extension"] = time.Since(pgExtStart).Seconds()

	dbCfg := db.LoadDBConfigFromEnv()
	secretSQL := db.BuildPostgresSecretSQL(dbCfg, "pg_secret")
	if _, err := conn.ExecContext(ctx, secretSQL); err != nil {
		return nil, fmt.Errorf("create postgres secret: %w", err)
	}

	attachStart := time.Now()
	attachSQL := db.BuildPostgresAttachSQL(dbCfg.SSLMode, "pg_secret", true)
	if _, err := conn.ExecContext(ctx, attachSQL); err != nil {
		return nil, fmt.Errorf("failed to attach PostgreSQL database: %w", err)
	}
	phaseSec["attach"] = time.Since(attachStart).Seconds()

	cfg, err := loadConfigFromTable(ctx, conn, "pg."+db.TableABRDBConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to load config from PostgreSQL: %w", err)
	}
	category := cfg.EnabledCategory
	if category == "" {
		return nil, fmt.Errorf("enabled_category not configured in PostgreSQL: run 'abrdb init' first")
	}

	defer func() {
		_, _ = conn.ExecContext(context.Background(), "DETACH pg;")
	}()

	switch category {
	case "basic":
		// No category-specific tables
	case "rsdtdsp":
		sec, err := execTimed(ctx, conn, "create", "rsdtdsp", createRsdtdspSQL)
		if err != nil {
			return nil, err
		}
		phaseSec["rsdtdsp"] = sec
	case "parcel":
		sec, err := execTimed(ctx, conn, "create", "parcel", createParcelSQL)
		if err != nil {
			return nil, err
		}
		phaseSec["parcel"] = sec
	case "all":
		sec, err := execTimed(ctx, conn, "create", "rsdtdsp", createRsdtdspSQL)
		if err != nil {
			return nil, err
		}
		phaseSec["rsdtdsp"] = sec
		sec, err = execTimed(ctx, conn, "create", "parcel", createParcelSQL)
		if err != nil {
			return nil, err
		}
		phaseSec["parcel"] = sec
	default:
		return nil, fmt.Errorf("unknown category: %q", category)
	}

	basicSec, err := insertBasicTables(ctx, conn)
	if err != nil {
		return nil, err
	}
	maps.Copy(phaseSec, basicSec)

	indexStart := time.Now()
	if err := createIndexes(ctx, conn); err != nil {
		return nil, fmt.Errorf("failed to create indexes: %w", err)
	}
	phaseSec["indexes"] = time.Since(indexStart).Seconds()

	spatialStart := time.Now()
	if err := createSpatialIndexes(ctx, conn); err != nil {
		return nil, fmt.Errorf("failed to create spatial indexes: %w", err)
	}
	phaseSec["spatial_indexes"] = time.Since(spatialStart).Seconds()

	if err := saveConfigToCache(ctx, conn, cfg); err != nil {
		return nil, fmt.Errorf("failed to save config: %w", err)
	}

	return phaseSec, nil
}

func insertBasicTables(ctx context.Context, conn *sql.DB) (map[string]float64, error) {
	phaseSec := make(map[string]float64)

	sec, err := execTimed(ctx, conn, "insert", "machiaza", insertMachiazaSQL)
	if err != nil {
		return nil, err
	}
	phaseSec["machiaza"] = sec

	sec, err = execTimed(ctx, conn, "insert", "city", insertCitySQL)
	if err != nil {
		return nil, err
	}
	phaseSec["city"] = sec

	sec, err = execTimed(ctx, conn, "insert", "pref", insertPrefSQL)
	if err != nil {
		return nil, err
	}
	phaseSec["pref"] = sec

	return phaseSec, nil
}

func saveConfigToCache(ctx context.Context, conn *sql.DB, cfg *Config) error {
	const insertSQL = `INSERT INTO cache_config (config_key, config_value) VALUES (?, ?)`
	configs := []struct{ key, value string }{
		{db.KeyABRDBVersion, cfg.DBVersion},
		{db.KeyEnabledCategory, cfg.EnabledCategory},
		{db.KeyEnabledPref, cfg.EnabledPref},
		{db.KeyEnabledPos, cfg.EnabledPos},
	}
	for _, c := range configs {
		if _, err := conn.ExecContext(ctx, insertSQL, c.key, c.value); err != nil {
			return fmt.Errorf("failed to insert %s: %w", c.key, err)
		}
	}
	// Add build time
	if _, err := conn.ExecContext(ctx, insertSQL, "build_time", time.Now().Format(time.RFC3339)); err != nil {
		return fmt.Errorf("failed to insert build_time: %w", err)
	}
	return nil
}

func execTimed(ctx context.Context, conn *sql.DB, action, name, stmt string) (float64, error) {
	start := time.Now()
	if _, err := conn.ExecContext(ctx, stmt); err != nil {
		return 0, fmt.Errorf("failed to %s %s: %w", action, name, err)
	}
	return time.Since(start).Seconds(), nil
}

// execSchemaSQL executes schema SQL obtained from a getter function.
func execSchemaSQL(ctx context.Context, conn *sql.DB, name string, getSQL func() (string, error)) error {
	sqlText, err := getSQL()
	if err != nil {
		return fmt.Errorf("failed to get %s SQL: %w", name, err)
	}
	if _, err := conn.ExecContext(ctx, sqlText); err != nil {
		return fmt.Errorf("failed to create %s: %w", name, err)
	}
	return nil
}

func createIndexes(ctx context.Context, conn *sql.DB) error {
	return execSchemaSQL(ctx, conn, "indexes", schema.GetCreateIndexesSQL)
}

func createSpatialIndexes(ctx context.Context, conn *sql.DB) error {
	return execSchemaSQL(ctx, conn, "spatial indexes", schema.GetCreateSpatialIndexesSQL)
}
