package cache

import (
	"context"
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/infra/config"
)

func TestApplyMemoryLimit_InvalidValue(t *testing.T) {
	for _, v := range []string{"abc", "-1GB", "1GB; DROP TABLE x", "2"} {
		t.Run(v, func(t *testing.T) {
			if err := applyMemoryLimit(context.Background(), nil, v); err == nil {
				t.Errorf("applyMemoryLimit(%q) = nil, want error", v)
			}
		})
	}
}

func TestApplyMemoryLimit_EmptyKeepsDefault(t *testing.T) {
	// nil conn: an empty value must return before touching the connection.
	if err := applyMemoryLimit(context.Background(), nil, ""); err != nil {
		t.Errorf("applyMemoryLimit(\"\") = %v, want nil", err)
	}
}

// TestNewDuckDBCache_MemoryLimit pins that the configured limit reaches DuckDB
// and that MemoryLimit reports the value serve logs at startup.
func TestNewDuckDBCache_MemoryLimit(t *testing.T) {
	ctx := context.Background()
	c, err := newDuckDBCache(ctx, quickstartCachePath, config.CacheConfig{DuckDBThreads: "2", DuckDBMemoryLimit: "512MiB"})
	if err != nil {
		t.Fatalf("newDuckDBCache() = %v", err)
	}
	defer func() { _ = c.Close() }()

	got, err := c.MemoryLimit(ctx)
	if err != nil {
		t.Fatalf("MemoryLimit() = %v", err)
	}
	if got != "512.0 MiB" {
		t.Errorf("MemoryLimit() = %q, want %q", got, "512.0 MiB")
	}
}
