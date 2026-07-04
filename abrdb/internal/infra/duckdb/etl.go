package duckdb

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"path/filepath"
	"strings"

	"abr.local/common/db"
	"abr.local/common/duck"

	"abrdb/internal/schema"
	"abrdb/internal/util"
)

const pgSecretName = "abrdb_pg_secret"

type tableNames struct {
	Text        string
	Pos         string
	Transformed string
}

func generateTableNames(suffix string) tableNames {
	return tableNames{
		Text:        "text_data" + suffix,
		Pos:         "pos_data" + suffix,
		Transformed: "transformed" + suffix,
	}
}

type ETL struct {
	db     *sql.DB
	pgConf db.DBConfig
}

type ETLConfig struct {
	DB db.DBConfig
}

func New(cfg ETLConfig) (*ETL, error) {
	duckDB, err := duck.Open("")
	if err != nil {
		return nil, fmt.Errorf("open duckdb: %w", err)
	}

	etl := &ETL{
		db:     duckDB,
		pgConf: cfg.DB,
	}

	if err := etl.initializeDuckDB(); err != nil {
		_ = duckDB.Close()
		return nil, fmt.Errorf("initialize duckdb: %w", err)
	}

	if err := etl.attachPostgres(); err != nil {
		_ = duckDB.Close()
		return nil, fmt.Errorf("attach postgres: %w", err)
	}

	return etl, nil
}

func (e *ETL) Close() error {
	return e.db.Close()
}

func (e *ETL) LoadData(ctx context.Context, categoryInfo *schema.CategoryInfo, textPath string, posPath string) error {
	suffix := "_" + strings.TrimSuffix(filepath.Base(textPath), ".csv.zip")
	suffix = strings.ReplaceAll(suffix, ".", "_")

	defer e.cleanupTempTables(context.Background(), suffix)

	tx, err := e.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	err = e.loadTextDataWithSuffixTx(ctx, tx, categoryInfo, textPath, suffix)
	if err != nil {
		return fmt.Errorf("load text data from %q: %w", filepath.Base(textPath), err)
	}

	hasPosData, err := e.loadPositionDataWithSuffixTx(ctx, tx, categoryInfo, posPath, suffix)
	if err != nil {
		return fmt.Errorf("load position data from %q: %w", filepath.Base(posPath), err)
	}

	filename := filepath.Base(textPath)
	err = e.transformAndLoadWithSuffixTx(ctx, tx, categoryInfo, hasPosData, suffix, filename)
	if err != nil {
		return fmt.Errorf("transform and load %q: %w", filename, err)
	}

	err = tx.Commit()
	return err
}

func (e *ETL) cleanupTempTables(ctx context.Context, suffix string) {
	tn := generateTableNames(suffix)
	for _, table := range []string{tn.Text, tn.Pos, tn.Transformed} {
		_, _ = e.db.ExecContext(ctx, "DROP TABLE IF EXISTS "+table)
	}
}

func csvNameFromZip(zipPath string) string {
	return strings.TrimSuffix(filepath.Base(zipPath), ".zip")
}

// DuckDB 1.4+ optimizations reduce type inference and enable parallel CSV reading.
func readZipSQL(tempTable, zipPath, csvName string, columns []string, columnTypes map[string]string, whereClause string) string {
	where := ""
	if whereClause != "" {
		where = " WHERE " + whereClause
	}
	return fmt.Sprintf(`
        CREATE OR REPLACE TEMP TABLE %s AS
        SELECT DISTINCT %s FROM read_csv('zip://%s/%s', header = true, auto_detect = true, parallel = true, sample_size = 1000, null_padding = true%s)%s
    `, tempTable, strings.Join(columns, ", "), zipPath, csvName, buildDTypesParam(columnTypes), where)
}

func buildDTypesParam(columnTypes map[string]string) string {
	if len(columnTypes) == 0 {
		return ""
	}
	var parts []string
	for col, typ := range columnTypes {
		parts = append(parts, fmt.Sprintf("'%s': '%s'", col, typ))
	}
	return fmt.Sprintf(", dtypes = {%s}", strings.Join(parts, ", "))
}

func buildWhereClause(filters map[string][]string) string {
	var clauses []string
	for column, values := range filters {
		if len(values) == 0 {
			continue
		}
		quoted := make([]string, len(values))
		for i, v := range values {
			quoted[i] = "'" + strings.ReplaceAll(v, "'", "''") + "'"
		}
		clauses = append(clauses, column+" IN ("+strings.Join(quoted, ", ")+")")
	}
	return strings.Join(clauses, " AND ")
}

func (e *ETL) loadTextDataWithSuffixTx(ctx context.Context, tx *sql.Tx, categoryInfo *schema.CategoryInfo, textPath string, suffix string) error {
	if textPath == "" {
		return errors.New("text file path is required")
	}

	csvName := csvNameFromZip(textPath)
	tn := generateTableNames(suffix)

	whereClause := buildWhereClause(categoryInfo.Filters)
	createTextSQL := readZipSQL(tn.Text, textPath, csvName, categoryInfo.TextColumns, categoryInfo.TextColumnTypes, whereClause)
	if _, err := tx.ExecContext(ctx, createTextSQL); err != nil {
		return fmt.Errorf("read ZIP file %q: %w", textPath, err)
	}

	// Verify data was loaded (after DISTINCT)
	// Note: tn.Text is generated internally with a UUID suffix, not user input
	var rowCount int
	if err := tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM "+tn.Text).Scan(&rowCount); err != nil {
		return fmt.Errorf("verify %s table: %w", tn.Text, err)
	}
	if rowCount == 0 {
		return fmt.Errorf("%s table is empty - no data was loaded from %q", tn.Text, textPath)
	}

	return nil
}

func (e *ETL) loadPositionDataWithSuffixTx(ctx context.Context, tx *sql.Tx, categoryInfo *schema.CategoryInfo, posPath string, suffix string) (bool, error) {
	if posPath == "" {
		return false, nil
	}

	tn := generateTableNames(suffix)
	csvName := csvNameFromZip(posPath)

	// Position data doesn't have status_flg, so no filtering needed
	createPosSQL := readZipSQL(tn.Pos, posPath, csvName, categoryInfo.PosColumns, categoryInfo.PosColumnTypes, "")
	if _, err := tx.ExecContext(ctx, createPosSQL); err != nil {
		// Return error to distinguish "file missing" from "load failure"
		return false, err
	}

	return true, nil
}

// DELETE → INSERT pattern: differential updates per file scope.
func (e *ETL) transformAndLoadWithSuffixTx(ctx context.Context, tx *sql.Tx, categoryInfo *schema.CategoryInfo, hasPosData bool, suffix string, filename string) error {
	transformer := newTransformer(categoryInfo)
	tn := generateTableNames(suffix)

	deleteCondition := buildDeleteCondition(filename)

	// DELETE → INSERT for differential updates
	query := fmt.Sprintf(`
		%s;
		DELETE FROM pg.%s WHERE %s;
		INSERT INTO pg.%s
		SELECT * EXCLUDE (join_seq) FROM %s WHERE join_seq = 1
	`, transformer.buildTransformSQL(hasPosData, tn),
		categoryInfo.TableName, deleteCondition,
		categoryInfo.TableName, tn.Transformed)

	_, err := tx.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("load %s data: %w", categoryInfo.TableName, err)
	}
	return nil
}

func buildDeleteCondition(filename string) string {
	p := util.ParseFilePattern(filename)

	switch p.Type {
	case util.PatternPref:
		// Always use lg_code prefix with zero-padding.
		// pref_code column is not present in any current category config.
		return fmt.Sprintf("SUBSTR(lg_code, 1, 2) = '%02d'", p.PrefNum)
	case util.PatternCity:
		return fmt.Sprintf("lg_code = '%s'", p.Code)
	case util.PatternAll:
		return "1=1"
	default:
		// Unknown pattern → delete nothing (safe default)
		return "1=0"
	}
}

func (e *ETL) initializeDuckDB() error {
	_, err := e.db.Exec(`
		INSTALL postgres; LOAD postgres;
		INSTALL zipfs FROM community; LOAD zipfs;
		INSTALL spatial; LOAD spatial;
	`)
	return err
}

func (e *ETL) attachPostgres() error {
	secretSQL := db.BuildPostgresSecretSQL(e.pgConf, pgSecretName)
	if _, err := e.db.Exec(secretSQL); err != nil {
		return fmt.Errorf("create postgres secret: %w", err)
	}
	attachSQL := buildPostgresAttachSQL(e.pgConf.SSLMode, pgSecretName)
	if _, err := e.db.Exec(attachSQL); err != nil {
		return fmt.Errorf("attach postgres: %w", err)
	}
	return nil
}

// sslmode rides on ATTACH's connection string because DuckDB's postgres SECRET
// type does not accept sslmode as a field.
func buildPostgresAttachSQL(sslMode, secretName string) string {
	opts := ""
	if sslMode != "" {
		opts = "sslmode=" + strings.ReplaceAll(sslMode, "'", "''")
	}
	return fmt.Sprintf("ATTACH '%s' AS pg (TYPE postgres, SECRET %s)", opts, secretName)
}
