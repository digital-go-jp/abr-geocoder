package cache

import (
	"context"
	"database/sql"
	"errors"
	"slices"
	"strconv"
	"testing"

	"abrg/internal/infra/duckdb"
	"abrg/internal/schema"
)

// TestQuickstartFixture_Structure pins the structure of the committed
// quickstart cache against static expectations: the exact table and index
// sets a basic build produces, at the schema version this binary loads. The
// fixture is updated by in-place surgery (a wholesale rebuild would shift data
// and break tests that pin row contents), and this test catches a botched
// surgery (leftover category tables or indexes, missing config, a version left
// behind).
func TestQuickstartFixture_Structure(t *testing.T) {
	ctx := context.Background()

	conn, err := duckdb.OpenReadOnly(quickstartCachePath)
	if err != nil {
		t.Fatalf("open quickstart cache: %v", err)
	}
	defer func() { _ = conn.Close() }()

	queryStrings := func(query string) []string {
		t.Helper()
		rows, err := conn.QueryContext(ctx, query)
		if err != nil {
			t.Fatalf("query %q: %v", query, err)
		}
		defer func() { _ = rows.Close() }()
		var got []string
		for rows.Next() {
			var s string
			if err := rows.Scan(&s); err != nil {
				t.Fatalf("scan: %v", err)
			}
			got = append(got, s)
		}
		if err := rows.Err(); err != nil {
			t.Fatalf("iterate: %v", err)
		}
		return got
	}

	wantTables := []string{"cache_city", "cache_config", "cache_machiaza", "cache_pref"}
	if got := queryStrings("SELECT table_name FROM information_schema.tables ORDER BY table_name"); !slices.Equal(got, wantTables) {
		t.Errorf("tables = %v, want %v", got, wantTables)
	}

	wantIndexes := []string{"idx_city_geom", "idx_machiaza_geom", "idx_machiaza_normalized", "idx_pref_geom"}
	if got := queryStrings("SELECT index_name FROM duckdb_indexes() ORDER BY index_name"); !slices.Equal(got, wantIndexes) {
		t.Errorf("indexes = %v, want %v", got, wantIndexes)
	}

	wantVersion, err := schema.Version()
	if err != nil {
		t.Fatalf("schema.Version(): %v", err)
	}

	for key, want := range map[string]string{
		KeySchemaVersion:   strconv.Itoa(wantVersion),
		"enabled_category": "basic",
		"enabled_pref":     "13",
		"enabled_pos":      "true",
	} {
		var got string
		err := conn.QueryRowContext(ctx,
			"SELECT config_value FROM cache_config WHERE config_key = ?", key).Scan(&got)
		if errors.Is(err, sql.ErrNoRows) {
			t.Errorf("cache_config[%q] missing, want %q", key, want)
			continue
		}
		if err != nil {
			t.Fatalf("read cache_config[%q]: %v", key, err)
		}
		if got != want {
			t.Errorf("cache_config[%q] = %q, want %q", key, got, want)
		}
	}
}
