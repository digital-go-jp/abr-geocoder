package cache

import (
	"flag"
	"testing"

	"abrg/internal/infra/duckdb"
)

const quickstartCachePath = "../../../quickstart/tokyo_basic.duckdb"

var refreshQuickstart = flag.Bool("refresh-quickstart-cache", false,
	"rewrite normalized_address in the committed quickstart cache")

// The committed quickstart cache is already checked by every test that opens
// it, so this only handles the other direction: bringing it back in line after
// the normalization rules change. It rewrites the one column rather than
// rebuilding the file, because other tests pin the contents of its rows.
func TestRefreshQuickstartCache(t *testing.T) {
	if !*refreshQuickstart {
		t.Skip("run with -refresh-quickstart-cache to rewrite the committed fixture")
	}

	db, err := duckdb.Open(quickstartCachePath)
	if err != nil {
		t.Fatalf("open quickstart cache: %v", err)
	}
	defer func() { _ = db.Close() }()

	updated, err := refreshNormalizedAddresses(t.Context(), db)
	if err != nil {
		t.Fatalf("refresh normalization: %v", err)
	}
	for i, table := range normalizedTables {
		t.Logf("%-15s %d row(s) rewritten", table.name, updated[i])
	}
}
