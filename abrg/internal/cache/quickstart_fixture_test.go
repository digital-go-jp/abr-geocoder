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

// TestQuickstartFixture_Structure checks that the committed quickstart cache
// has exactly the tables, indexes and config of a basic build at the current
// schema version. The fixture is edited in place, because a rebuild would change
// row contents that other tests assert on, and this test catches a bad edit.
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

	wantIndexes := []string{"idx_machiaza_normalized"}
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
