package cache

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

// normalizedPart is one column of normalized_address as the build reads it from
// PostgreSQL and as the cache stores it. For koaza the two differ by more than a
// table alias, because the cache has already split it on koaza_aka_code. Pairing
// them keeps a column from being added to one side only.
type normalizedPart struct {
	build  string
	verify string
}

// The machiaza order puts kyoto_st before oaza_cho: a Kyoto street name
// precedes the town in the written address.
var machiazaNormalizedParts = []normalizedPart{
	{build: "c.county", verify: "county"},
	{build: "c.city", verify: "city"},
	{build: "c.ward", verify: "ward"},
	{build: "CASE WHEN t.koaza_aka_code = 2 THEN t.koaza ELSE NULL END", verify: "kyoto_st"},
	{build: "t.oaza_cho", verify: "oaza_cho"},
	{build: "t.chome", verify: "chome"},
	{build: "CASE WHEN t.koaza_aka_code = 2 THEN NULL ELSE t.koaza END", verify: "koaza"},
}

var cityNormalizedParts = []normalizedPart{
	{build: "c.county", verify: "county"},
	{build: "c.city", verify: "city"},
	{build: "c.ward", verify: "ward"},
}

var prefNormalizedParts = []normalizedPart{
	{build: "p.pref", verify: "pref"},
}

// normalizedExpr wraps cols in the normalize_text_go call. The build and the
// check both use it so the call cannot differ between them.
func normalizedExpr(cols []string) string {
	return fmt.Sprintf("normalize_text_go(CONCAT_WS('', %s))", strings.Join(cols, ", "))
}

func buildNormalizedExpr(parts []normalizedPart) string {
	cols := make([]string, len(parts))
	for i, p := range parts {
		cols[i] = p.build
	}
	return normalizedExpr(cols)
}

func verifyNormalizedExpr(parts []normalizedPart) string {
	cols := make([]string, len(parts))
	for i, p := range parts {
		cols[i] = p.verify
	}
	return normalizedExpr(cols)
}

// normalizedTable is a table to check and the parts of its normalized_address.
type normalizedTable struct {
	name  string
	parts []normalizedPart
	// sample is the SQL expression naming a row in the error message. A
	// machiaza_id is unique only within its lg_code, so both are shown.
	sample string
}

const lgCodeSample = `'lg_code=' || lg_code`

var normalizedTables = []normalizedTable{
	{name: "cache_pref", parts: prefNormalizedParts, sample: lgCodeSample},
	{name: "cache_city", parts: cityNormalizedParts, sample: lgCodeSample},
	{name: "cache_machiaza", parts: machiazaNormalizedParts, sample: lgCodeSample + ` || ' machiaza_id=' || machiaza_id`},
}

const normalizedSampleLimit = 5

// verifyNormalization rejects the cache if any stored normalized_address
// differs from one recomputed from its columns. It compares with IS DISTINCT
// FROM because <> skips rows where either side is NULL.
func verifyNormalization(ctx context.Context, db *sql.DB) error {
	if err := registerUDF(ctx, db); err != nil {
		return err
	}
	for _, t := range normalizedTables {
		if err := verifyNormalizedTable(ctx, db, t); err != nil {
			return err
		}
	}
	return nil
}

func verifyNormalizedTable(ctx context.Context, db *sql.DB, t normalizedTable) error {
	// COUNT(*) OVER () is computed before LIMIT, so one query returns both the
	// total and a few sample rows.
	query := fmt.Sprintf(
		"SELECT COUNT(*) OVER () AS total, %s FROM %s WHERE normalized_address IS DISTINCT FROM %s LIMIT %d",
		t.sample, t.name, verifyNormalizedExpr(t.parts), normalizedSampleLimit)

	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to check %s normalization: %w", t.name, err)
	}
	defer func() { _ = rows.Close() }()

	var total int
	var samples []string
	for rows.Next() {
		var sample string
		if err := rows.Scan(&total, &sample); err != nil {
			return fmt.Errorf("failed to scan %s normalization mismatch: %w", t.name, err)
		}
		samples = append(samples, sample)
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("failed to check %s normalization: %w", t.name, err)
	}
	if total == 0 {
		return nil
	}
	return fmt.Errorf(
		"cache was built by a binary with different address normalization: %s has %d row(s) whose normalized_address no longer matches (%s): run 'abrg cache build' to rebuild",
		t.name, total, strings.Join(samples, ", "))
}

// refreshNormalizedAddresses rewrites normalized_address with the current
// normalization and returns the rows changed per table, in normalizedTables
// order. It reads only the cache's columns, so it needs no ABR data.
func refreshNormalizedAddresses(ctx context.Context, db *sql.DB) ([]int64, error) {
	if err := registerUDF(ctx, db); err != nil {
		return nil, err
	}

	updated := make([]int64, len(normalizedTables))
	for i, t := range normalizedTables {
		expr := verifyNormalizedExpr(t.parts)
		stmt := fmt.Sprintf(
			"UPDATE %s SET normalized_address = %s WHERE normalized_address IS DISTINCT FROM %s",
			t.name, expr, expr)
		res, err := db.ExecContext(ctx, stmt)
		if err != nil {
			return nil, fmt.Errorf("failed to refresh %s normalization: %w", t.name, err)
		}
		if updated[i], err = res.RowsAffected(); err != nil {
			return nil, fmt.Errorf("failed to count refreshed %s rows: %w", t.name, err)
		}
	}
	return updated, nil
}
