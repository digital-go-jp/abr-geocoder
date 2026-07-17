package postgres

import (
	"context"
	"fmt"

	"abrdb/internal/infra/db"
	"abrdb/internal/util"
)

// DeleteFileScope removes rows previously imported from the given source file,
// so a re-import replaces them. Executed directly on PostgreSQL: routing the
// DELETE through the DuckDB postgres extension scans the remote table per
// statement, which dominated import time at scale.
func DeleteFileScope(ctx context.Context, executor *db.QueryExecutor, tableName, filename string) error {
	query := fmt.Sprintf("DELETE FROM %s WHERE %s", tableName, buildDeleteCondition(filename))
	if _, err := executor.Exec(ctx, query); err != nil {
		return fmt.Errorf("delete %s rows for %q: %w", tableName, filename, err)
	}
	return nil
}

// TableIsEmpty reports whether the table has no rows.
func TableIsEmpty(ctx context.Context, executor *db.QueryExecutor, tableName string) (bool, error) {
	var exists bool
	row := executor.Pool().QueryRow(ctx, fmt.Sprintf("SELECT EXISTS (SELECT 1 FROM %s)", tableName))
	if err := row.Scan(&exists); err != nil {
		return false, fmt.Errorf("check %s is empty: %w", tableName, err)
	}
	return !exists, nil
}

// EnsureLgCodeIndex creates the index backing DeleteFileScope's conditions.
// Created after the initial bulk insert rather than in the table DDL, so the
// first import does not pay row-by-row index maintenance.
func EnsureLgCodeIndex(ctx context.Context, executor *db.QueryExecutor, tableName string) error {
	query := fmt.Sprintf("CREATE INDEX IF NOT EXISTS idx_%s_lg_code ON %s (lg_code)", tableName, tableName)
	if _, err := executor.Exec(ctx, query); err != nil {
		return fmt.Errorf("create lg_code index on %s: %w", tableName, err)
	}
	return nil
}

func buildDeleteCondition(filename string) string {
	p := util.ParseFilePattern(filename)

	switch p.Type {
	case util.PatternPref:
		// Range condition on the two-digit lg_code prefix so the lg_code
		// index applies (SUBSTR/LIKE would not be sargable).
		// pref_code column is not present in any current category config.
		return fmt.Sprintf("lg_code >= '%02d' AND lg_code < '%02d'", p.PrefNum, p.PrefNum+1)
	case util.PatternCity:
		return fmt.Sprintf("lg_code = '%s'", p.Code)
	case util.PatternAll:
		return "1=1"
	default:
		// Unknown pattern → delete nothing (safe default)
		return "1=0"
	}
}
