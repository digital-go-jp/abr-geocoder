package matching

import (
	"context"
	"database/sql"
	"sync"
	"testing"

	"abrg/internal/cache"
)

var initTestCache = sync.OnceValues(func() (*cache.DuckDBCache, error) {
	return cache.NewDuckDBCache(context.Background())
})

// setupTestDB creates a DuckDB connection for testing.
// Thread-safe and cached after first call.
// Skips the test if cache file is not available (e.g., in CI environment).
func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()

	c, err := initTestCache()
	if err != nil {
		t.Skipf("Skipping test: DuckDB cache not available: %v", err)
	}
	return c.DB()
}
