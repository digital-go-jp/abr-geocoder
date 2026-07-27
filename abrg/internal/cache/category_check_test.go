package cache

import (
	"context"
	"strconv"
	"strings"
	"testing"

	"abrg/internal/schema"
)

// Stub category tables: checkCategoryTables only verifies existence, and the
// open path never queries them, so the column shape does not matter here.
const (
	stubRsdtdspSQL = "CREATE TABLE cache_rsdtdsp (dummy INTEGER)"
	stubParcelSQL  = "CREATE TABLE cache_parcel (dummy INTEGER)"
)

func TestNewDuckDBCacheFromPath_CategoryTableCheck(t *testing.T) {
	ctx := context.Background()
	current, err := schema.Version()
	if err != nil {
		t.Fatalf("schema.Version(): %v", err)
	}
	configRows := func(category string) map[string]string {
		return map[string]string{
			KeySchemaVersion:   strconv.Itoa(current),
			"enabled_category": category,
		}
	}
	mustOpen := func(t *testing.T, path string) {
		t.Helper()
		c, err := NewDuckDBCacheFromPath(ctx, path)
		if err != nil {
			t.Fatalf("NewDuckDBCacheFromPath() error = %v, want nil", err)
		}
		_ = c.Close()
	}

	t.Run("basic needs no category tables", func(t *testing.T) {
		mustOpen(t, newTestCacheFile(t, configRows("basic")))
	})

	t.Run("rsdtdsp with its table opens", func(t *testing.T) {
		mustOpen(t, newTestCacheFile(t, configRows("rsdtdsp"), stubRsdtdspSQL))
	})

	t.Run("all with both tables opens", func(t *testing.T) {
		mustOpen(t, newTestCacheFile(t, configRows("all"), stubRsdtdspSQL, stubParcelSQL))
	})

	t.Run("all without rsdtdsp is rejected", func(t *testing.T) {
		path := newTestCacheFile(t, configRows("all"), stubParcelSQL)
		_, err := NewDuckDBCacheFromPath(ctx, path)
		if err == nil {
			t.Fatal("NewDuckDBCacheFromPath() = nil, want error")
		}
		for _, want := range []string{
			"cache is corrupted or incomplete",
			"cache_rsdtdsp missing while enabled_category=all",
			"abrg cache build",
		} {
			if !strings.Contains(err.Error(), want) {
				t.Errorf("error %q does not contain %q", err, want)
			}
		}
	})

	t.Run("parcel without its table is rejected", func(t *testing.T) {
		path := newTestCacheFile(t, configRows("parcel"))
		_, err := NewDuckDBCacheFromPath(ctx, path)
		if err == nil {
			t.Fatal("NewDuckDBCacheFromPath() = nil, want error")
		}
		if !strings.Contains(err.Error(), "cache_parcel missing while enabled_category=parcel") {
			t.Errorf("error %q does not mention the missing table", err)
		}
	})
}

// TestNewDuckDBCacheFromPath_CancelledContext pins the fail-fast contract: a
// context that is already cancelled must abort the open-time checks with an
// error instead of being mistaken for a missing key or table.
func TestNewDuckDBCacheFromPath_CancelledContext(t *testing.T) {
	current, err := schema.Version()
	if err != nil {
		t.Fatalf("schema.Version(): %v", err)
	}
	path := newTestCacheFile(t, map[string]string{KeySchemaVersion: strconv.Itoa(current)})

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	if _, err := NewDuckDBCacheFromPath(ctx, path); err == nil {
		t.Fatal("NewDuckDBCacheFromPath() with cancelled context = nil error, want error")
	}
}
