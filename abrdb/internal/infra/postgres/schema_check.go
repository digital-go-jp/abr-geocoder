package postgres

import (
	"context"
	"fmt"
	"maps"
	"slices"
	"strings"

	"abrdb/internal/infra/db"
)

// VerifyTableColumns checks that every table in required exists in the public
// schema with all of its required columns. The import config is resolved from
// the running binary while the tables come from `abrdb init`, which may have
// run with a different config; a mismatch must stop the import before data
// flows into drifted tables.
func VerifyTableColumns(ctx context.Context, executor *db.QueryExecutor, required map[string][]string) error {
	tables := slices.Sorted(maps.Keys(required))
	rows, err := executor.Query(ctx, `
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ANY($1)
    `, tables)
	if err != nil {
		return fmt.Errorf("query table columns: %w", err)
	}
	defer rows.Close()

	actual := make(map[string]map[string]bool)
	for rows.Next() {
		var table, column string
		if err := rows.Scan(&table, &column); err != nil {
			return fmt.Errorf("scan table column: %w", err)
		}
		if actual[table] == nil {
			actual[table] = make(map[string]bool)
		}
		actual[table][column] = true
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate table columns: %w", err)
	}

	if problems := missingTableColumns(required, actual); len(problems) > 0 {
		return fmt.Errorf("import config has changed since 'abrdb init' (%s): run 'abrdb init' to rebuild the database (reimports all data)",
			strings.Join(problems, "; "))
	}
	return nil
}

// missingTableColumns describes, in table order, every required table that is
// absent from actual or lacks required columns.
func missingTableColumns(required map[string][]string, actual map[string]map[string]bool) []string {
	var problems []string
	for _, table := range slices.Sorted(maps.Keys(required)) {
		cols, ok := actual[table]
		if !ok {
			problems = append(problems, fmt.Sprintf("table %s is missing", table))
			continue
		}
		var missing []string
		for _, col := range required[table] {
			if !cols[col] {
				missing = append(missing, col)
			}
		}
		if len(missing) > 0 {
			problems = append(problems, fmt.Sprintf("table %s is missing columns: %s", table, strings.Join(missing, ", ")))
		}
	}
	return problems
}
