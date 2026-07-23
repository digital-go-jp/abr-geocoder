package matching

import (
	"database/sql"
	"testing"

	"abrg/internal/cache"
	"abrg/internal/testutil"
)

var initTestCache = testutil.NewCacheOnce(func(c *cache.DuckDBCache) (*cache.DuckDBCache, error) {
	return c, nil
})

// setupTestDB creates a DuckDB connection for testing.
// Thread-safe and cached after first call.
// Skips the test if cache file is not available (e.g., in CI environment).
func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	return testutil.Setup(t, initTestCache).DB()
}
