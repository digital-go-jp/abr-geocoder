package matching

import (
	"testing"

	"abrg/internal/cache"
	"abrg/internal/testutil"
)

// SetupTestCache returns the shared test cache, skipping when it is unavailable.
func SetupTestCache(t *testing.T) *cache.DuckDBCache {
	t.Helper()
	return testutil.Setup(t, initTestCache)
}
