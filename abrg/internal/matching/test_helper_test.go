package matching

import (
	"context"
	"database/sql"
	"testing"

	"abrg/internal/cache"
	"abrg/internal/repository"
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

var initTestMatcher = testutil.NewCacheOnce(func(c *cache.DuckDBCache) (*Impl, error) {
	cfg, err := cache.LoadConfig(context.Background(), c.DB())
	if err != nil {
		return nil, err
	}
	return NewMatcher(repository.NewRepository(c.DB()), c.Lookups(), cfg.HasResidential(), cfg.HasParcel()), nil
})

// setupTestMatcher returns a matcher over the shared test cache,
// skipping the test when the cache is unavailable.
func setupTestMatcher(t *testing.T) *Impl {
	t.Helper()
	return testutil.Setup(t, initTestMatcher)
}
