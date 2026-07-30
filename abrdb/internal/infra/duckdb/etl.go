package duckdb

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"path/filepath"
	"regexp"
	"strings"
	"time"

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

// nonIdentChar matches any character not allowed in a table-name suffix.
var nonIdentChar = regexp.MustCompile(`[^A-Za-z0-9_]`)

func generateTableNames(suffix string) tableNames {
	// The suffix becomes part of a SQL identifier (table name), which cannot be
	// parameterized. Restrict it to identifier-safe characters so a crafted source
	// filename cannot inject SQL.
	suffix = nonIdentChar.ReplaceAllString(suffix, "_")
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
	tn := generateTableNames("_" + strings.TrimSuffix(filepath.Base(textPath), ".csv.zip"))

	// TEMP tables are connection-local in DuckDB and survive the commit, so
	// the whole load runs on one pinned connection and the deferred DROP uses
	// that same connection; a pool-level DROP would land on an arbitrary
	// connection and silently miss them, accumulating them in memory.
	conn, err := e.db.Conn(ctx)
	if err != nil {
		return fmt.Errorf("acquire duckdb connection: %w", err)
	}
	defer func() { _ = conn.Close() }()
	// WithoutCancel keeps the cleanup working after a mid-import cancellation.
	defer cleanupTempTables(context.WithoutCancel(ctx), conn, tn)

	tx, err := conn.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	start := time.Now()
	err = e.loadTextDataTx(ctx, tx, categoryInfo, textPath, tn)
	if err != nil {
		return fmt.Errorf("load text data from %q: %w", filepath.Base(textPath), err)
	}
	textSec := time.Since(start).Seconds()

	start = time.Now()
	hasPosData, err := e.loadPositionDataTx(ctx, tx, categoryInfo, posPath, tn)
	if err != nil {
		return fmt.Errorf("load position data from %q: %w", filepath.Base(posPath), err)
	}
	posSec := time.Since(start).Seconds()

	filename := filepath.Base(textPath)
	start = time.Now()
	err = e.transformAndLoadTx(ctx, tx, categoryInfo, hasPosData, tn, filename)
	if err != nil {
		return fmt.Errorf("transform and load %q: %w", filename, err)
	}
	transformSec := time.Since(start).Seconds()

	start = time.Now()
	err = tx.Commit()
	slog.DebugContext(ctx, "etl step timing", "event", "etl_timing",
		"file", filename, "text_sec", textSec, "pos_sec", posSec,
		"transform_load_sec", transformSec, "commit_sec", time.Since(start).Seconds())
	return err
}

func cleanupTempTables(ctx context.Context, conn *sql.Conn, tn tableNames) {
	for _, table := range []string{tn.Text, tn.Pos, tn.Transformed} {
		_, _ = conn.ExecContext(ctx, "DROP TABLE IF EXISTS "+table)
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
	parts := make([]string, 0, len(columnTypes))
	for col, typ := range columnTypes {
		parts = append(parts, fmt.Sprintf("'%s': '%s'", col, typ))
	}
	return fmt.Sprintf(", dtypes = {%s}", strings.Join(parts, ", "))
}

func buildWhereClause(filters map[string][]string) string {
	clauses := make([]string, 0, len(filters))
	for column, values := range filters {
		if len(values) == 0 {
			continue
		}
		quoted := make([]string, len(values))
		for i, v := range values {
			quoted[i] = "'" + db.SqlEscape(v) + "'"
		}
		clauses = append(clauses, column+" IN ("+strings.Join(quoted, ", ")+")")
	}
	return strings.Join(clauses, " AND ")
}

func (e *ETL) loadTextDataTx(ctx context.Context, tx *sql.Tx, categoryInfo *schema.CategoryInfo, textPath string, tn tableNames) error {
	if textPath == "" {
		return errors.New("text file path is required")
	}

	csvName := csvNameFromZip(textPath)

	whereClause := buildWhereClause(categoryInfo.Filters)
	createTextSQL := readZipSQL(tn.Text, textPath, csvName, categoryInfo.TextColumns, categoryInfo.TextColumnTypes, whereClause)
	if _, err := tx.ExecContext(ctx, createTextSQL); err != nil {
		return fmt.Errorf("read ZIP file %q: %w", textPath, err)
	}

	// Verify data was loaded (after DISTINCT)
	// tn.Text is an internally generated, identifier-sanitized table name
	// (see generateTableNames), not raw user input.
	var rowCount int
	if err := tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM "+tn.Text).Scan(&rowCount); err != nil {
		return fmt.Errorf("verify %s table: %w", tn.Text, err)
	}
	if rowCount == 0 {
		return fmt.Errorf("%s table is empty - no data was loaded from %q", tn.Text, textPath)
	}

	return nil
}

func (e *ETL) loadPositionDataTx(ctx context.Context, tx *sql.Tx, categoryInfo *schema.CategoryInfo, posPath string, tn tableNames) (bool, error) {
	if posPath == "" {
		return false, nil
	}

	csvName := csvNameFromZip(posPath)

	// Position data doesn't have status_flg, so no filtering needed
	createPosSQL := readZipSQL(tn.Pos, posPath, csvName, categoryInfo.PosColumns, categoryInfo.PosColumnTypes, "")
	if _, err := tx.ExecContext(ctx, createPosSQL); err != nil {
		// Return error to distinguish "file missing" from "load failure"
		return false, err
	}

	return true, nil
}

// Rows for this file's scope are deleted beforehand via a direct PostgreSQL
// connection (see postgres.DeleteFileScope); here we only transform and insert.
func (e *ETL) transformAndLoadTx(ctx context.Context, tx *sql.Tx, categoryInfo *schema.CategoryInfo, hasPosData bool, tn tableNames, filename string) error {
	transformer := newTransformer(categoryInfo)

	insertSQL, err := buildInsertSQL(categoryInfo, tn.Transformed)
	if err != nil {
		return fmt.Errorf("build insert for %s: %w", categoryInfo.TableName, err)
	}

	steps := []struct {
		name string
		sql  string
	}{
		{"transform", transformer.buildTransformSQL(hasPosData, tn)},
		{"insert", insertSQL},
	}
	stepSec := make([]any, 0, len(steps)*2)
	for _, step := range steps {
		start := time.Now()
		if _, err := tx.ExecContext(ctx, step.sql); err != nil {
			return fmt.Errorf("load %s data (%s): %w", categoryInfo.TableName, step.name, err)
		}
		stepSec = append(stepSec, step.name+"_sec", time.Since(start).Seconds())
	}
	slog.DebugContext(ctx, "transform step timing", append([]any{"event", "transform_timing", "file", filename}, stepSec...)...)
	return nil
}

// buildInsertSQL lists the same explicit columns (CategoryInfo.OutputColumns)
// on both the INSERT and the SELECT side, so a column-order drift between the
// transformed temp table and the PostgreSQL DDL fails loudly instead of
// inserting silently misaligned data (the previous SELECT * EXCLUDE form
// relied on the two orders matching by construction).
func buildInsertSQL(categoryInfo *schema.CategoryInfo, transformedTable string) (string, error) {
	table, err := util.QuoteIdentifier(categoryInfo.TableName)
	if err != nil {
		return "", err
	}
	if len(categoryInfo.OutputColumns) == 0 {
		return "", fmt.Errorf("no output columns for table %s", categoryInfo.TableName)
	}
	quoted := make([]string, len(categoryInfo.OutputColumns))
	for i, col := range categoryInfo.OutputColumns {
		if quoted[i], err = util.QuoteIdentifier(col); err != nil {
			return "", err
		}
	}
	cols := strings.Join(quoted, ", ")
	return fmt.Sprintf("INSERT INTO pg.%s (%s) SELECT %s FROM %s WHERE join_seq = 1",
		table, cols, cols, transformedTable), nil
}

func (e *ETL) initializeDuckDB() error {
	_, err := e.db.ExecContext(context.Background(), `
		INSTALL postgres; LOAD postgres;
		INSTALL zipfs FROM community; LOAD zipfs;
		INSTALL spatial; LOAD spatial;
	`)
	return err
}

func (e *ETL) attachPostgres() error {
	secretSQL := db.BuildPostgresSecretSQL(e.pgConf, pgSecretName)
	if _, err := e.db.ExecContext(context.Background(), secretSQL); err != nil {
		return fmt.Errorf("create postgres secret: %w", err)
	}
	attachSQL := db.BuildPostgresAttachSQL(e.pgConf.SSLMode, pgSecretName, false)
	if _, err := e.db.ExecContext(context.Background(), attachSQL); err != nil {
		return fmt.Errorf("attach postgres: %w", err)
	}
	return nil
}
