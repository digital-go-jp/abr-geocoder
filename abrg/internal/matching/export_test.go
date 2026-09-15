package matching

import (
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/cache"
	"github.com/digital-go-jp/abr-geocoder/abrg/internal/testutil"
)

// SetupTestCache returns the shared test cache, skipping when it is unavailable.
func SetupTestCache(t *testing.T) *cache.DuckDBCache {
	t.Helper()
	return testutil.Setup(t, initTestCache)
}
