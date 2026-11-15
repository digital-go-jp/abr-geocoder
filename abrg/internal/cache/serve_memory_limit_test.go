package cache

import (
	"context"
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/infra/duckdb"
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

func TestApplyMemoryLimit_SetsLimit(t *testing.T) {
	ctx := context.Background()
	conn, err := duckdb.OpenReadOnly(quickstartCachePath)
	if err != nil {
		t.Fatalf("open cache: %v", err)
	}
	defer func() { _ = conn.Close() }()

	if err := applyMemoryLimit(ctx, conn, "512MiB"); err != nil {
		t.Fatalf("applyMemoryLimit() = %v", err)
	}

	var got string
	if err := conn.QueryRowContext(ctx, "SELECT current_setting('memory_limit')").Scan(&got); err != nil {
		t.Fatalf("read memory_limit: %v", err)
	}
	if got != "512.0 MiB" {
		t.Errorf("memory_limit = %q, want %q", got, "512.0 MiB")
	}
}
