package matching

import (
	"testing"

	"abrg/internal/cache"
)

// Skips the test if cache is not available.
func SetupTestCache(t *testing.T) *cache.DuckDBCache {
	t.Helper()

	c, err := initTestCache()
	if err != nil {
		t.Skipf("Skipping test: DuckDB cache not available: %v", err)
	}
	return c
}
