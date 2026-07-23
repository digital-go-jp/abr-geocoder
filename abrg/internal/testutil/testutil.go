// Package testutil provides helpers for tests that need the DuckDB cache.
package testutil

import (
	"context"
	"sync"
	"testing"

	"abrg/internal/cache"
)

// NewCacheOnce returns a lazily-initialized, cached constructor for a value
// built from the shared DuckDB cache.
func NewCacheOnce[T any](build func(c *cache.DuckDBCache) (T, error)) func() (T, error) {
	return sync.OnceValues(func() (T, error) {
		c, err := cache.NewDuckDBCache(context.Background())
		if err != nil {
			var zero T
			return zero, err
		}
		return build(c)
	})
}

// Setup returns the cached value or skips the test when the cache is unavailable.
func Setup[T any](t *testing.T, init func() (T, error)) T {
	t.Helper()
	v, err := init()
	if err != nil {
		t.Skipf("Skipping test: DuckDB cache not available: %v", err)
	}
	return v
}
