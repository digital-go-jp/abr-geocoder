package cache

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"abr.local/common/duck"
)

// normalizedPart is one column of a normalized_address in the two forms it
// takes: the expression the build reads from PostgreSQL, and the column the
// cache stores it in. The two differ by more than a table alias - the machiaza
// parts split koaza on koaza_aka_code, which the cache has already resolved
// into separate columns. Pairing them here keeps a column from being added to
// one side only.
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

// normalizedExpr renders columns into the normalize_text_go call that produces
// a normalized_address. Both sides go through it so the call itself cannot
// differ between the build and the check.
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

// normalizedTable names a table to check and the parts its normalized_address
// is made of.
type normalizedTable struct {
	name  string
	parts []normalizedPart
	// sample is the SQL expression identifying a row in the error message. A
	// machiaza_id is unique only within its municipality, so it is always
	// shown with its lg_code.
	sample string
}

const lgCodeSample = `'lg_code=' || lg_code`

var normalizedTables = []normalizedTable{
	{name: "cache_pref", parts: prefNormalizedParts, sample: lgCodeSample},
	{name: "cache_city", parts: cityNormalizedParts, sample: lgCodeSample},
	{name: "cache_machiaza", parts: machiazaNormalizedParts, sample: lgCodeSample + ` || ' machiaza_id=' || machiaza_id`},
}

const normalizedSampleLimit = 5

// verifyNormalization recomputes normalized_address from the source columns
// and rejects the cache if any row disagrees with the stored value.
//
// The comparison is IS DISTINCT FROM because <> does not count rows where
// either side is NULL.
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
	// COUNT(*) OVER () is evaluated over the whole match set before LIMIT
	// applies, so one query yields both the total and the first few rows to
	// name. No rows back means the table agrees.
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

// refreshNormalizedAddresses rewrites normalized_address with what the current
// normalization produces, returning the rows changed per table in the order of
// normalizedTables. It reuses the build's own expressions, so it needs no ABR
// data and is deterministic.
func refreshNormalizedAddresses(ctx context.Context, db *sql.DB) ([]int64, error) {
	// The tables carry RTREE indexes on geom, which DuckDB binds before any
	// write - even one that only touches the text column.
	if err := duck.LoadExtension(ctx, db, "spatial"); err != nil {
		return nil, fmt.Errorf("failed to load spatial extension: %w", err)
	}
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
