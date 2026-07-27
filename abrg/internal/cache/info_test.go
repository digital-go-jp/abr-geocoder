package cache

import (
	"context"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"abrg/internal/schema"
)

// TestInfo_SizeMB tests the SizeMB method of Info.
func TestInfo_SizeMB(t *testing.T) {
	tests := []struct {
		name string
		size int64
		want float64
	}{
		{"zero bytes", 0, 0},
		{"1 MB", 1024 * 1024, 1.0},
		{"10 MB", 10 * 1024 * 1024, 10.0},
		{"1.5 MB", 1536 * 1024, 1.5},
		{"500 KB", 512 * 1024, 0.5},
		{"1 byte", 1, 1.0 / (1024 * 1024)},
	}

	const epsilon = 1e-9
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info := &Info{Size: tt.size}
			got := info.SizeMB()
			if math.Abs(got-tt.want) > epsilon {
				t.Errorf("Info.SizeMB() = %v, want %v", got, tt.want)
			}
		})
	}
}

// TestFileInfo tests the FileInfo function.
func TestFileInfo(t *testing.T) {
	// Create a temporary file for testing
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "test.duckdb")

	// Create a test file with known size
	content := []byte("test content for cache file")
	if err := os.WriteFile(tmpFile, content, 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	t.Run("existing file", func(t *testing.T) {
		info, err := FileInfo(tmpFile)
		if err != nil {
			t.Fatalf("FileInfo() error = %v", err)
		}

		if info.Path != tmpFile {
			t.Errorf("FileInfo().Path = %q, want %q", info.Path, tmpFile)
		}
		if info.Size != int64(len(content)) {
			t.Errorf("FileInfo().Size = %d, want %d", info.Size, len(content))
		}
		if info.Tables != nil {
			t.Errorf("FileInfo().Tables = %v, want nil", info.Tables)
		}
	})

	t.Run("non-existent file", func(t *testing.T) {
		_, err := FileInfo(filepath.Join(tmpDir, "nonexistent.duckdb"))
		if err == nil {
			t.Error("FileInfo() expected error for non-existent file")
		}
	})
}

// TestLoadInfo_OmitsAbsentTables pins that tables not present in the cache
// (category tables of a build that did not need them) are left out of the
// Tables map instead of being reported as unavailable.
func TestLoadInfo_OmitsAbsentTables(t *testing.T) {
	path := newTestCacheFile(t, map[string]string{"build_time": "2026-01-01T00:00:00Z"}, stubRsdtdspSQL)

	info, err := LoadInfo(context.Background(), path)
	if err != nil {
		t.Fatalf("LoadInfo() error = %v", err)
	}

	if info.BuildTime != "2026-01-01T00:00:00Z" {
		t.Errorf("BuildTime = %q, want the config value", info.BuildTime)
	}
	for _, table := range []string{"cache_pref", "cache_city", "cache_machiaza", "cache_rsdtdsp"} {
		if count, ok := info.Tables[table]; !ok || count != 0 {
			t.Errorf("Tables[%q] = %d, %v; want 0, true", table, count, ok)
		}
	}
	if count, ok := info.Tables["cache_parcel"]; ok {
		t.Errorf("Tables[cache_parcel] = %d, want omitted", count)
	}
}

// TestLoadInfo_SchemaVersionWarning pins that LoadInfo reports a failed
// schema version check as a warning with rebuild advice instead of refusing
// to inspect the cache.
func TestLoadInfo_SchemaVersionWarning(t *testing.T) {
	ctx := context.Background()

	tests := []struct {
		name        string
		configRows  map[string]string
		wantWarning []string
	}{
		{
			name:        "missing schema version",
			configRows:  nil,
			wantWarning: []string{"no schema version", "abrg cache build"},
		},
		{
			name:        "mismatched schema version",
			configRows:  map[string]string{KeySchemaVersion: "999"},
			wantWarning: []string{"cache schema version 999", "abrg cache build"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info, err := LoadInfo(ctx, newTestCacheFile(t, tt.configRows))
			if err != nil {
				t.Fatalf("LoadInfo() error = %v", err)
			}
			for _, want := range tt.wantWarning {
				if !strings.Contains(info.Warning, want) {
					t.Errorf("Warning %q does not contain %q", info.Warning, want)
				}
			}
		})
	}

	t.Run("current schema version has no warning", func(t *testing.T) {
		current, err := schema.Version()
		if err != nil {
			t.Fatalf("schema.Version(): %v", err)
		}
		info, err := LoadInfo(ctx, newTestCacheFile(t, map[string]string{KeySchemaVersion: strconv.Itoa(current)}))
		if err != nil {
			t.Fatalf("LoadInfo() error = %v", err)
		}
		if info.Warning != "" {
			t.Errorf("Warning = %q, want empty", info.Warning)
		}
	})
}

// TestInfo_Fields tests that Info struct fields are correctly set.
func TestInfo_Fields(t *testing.T) {
	tables := map[string]int{"cache_machiaza": 100, "cache_parcel": 200}

	info := &Info{
		Path:   "/path/to/cache.duckdb",
		Size:   1024 * 1024 * 50, // 50 MB
		Tables: tables,
	}

	if info.Path != "/path/to/cache.duckdb" {
		t.Errorf("Info.Path = %q, want %q", info.Path, "/path/to/cache.duckdb")
	}
	if info.Size != 1024*1024*50 {
		t.Errorf("Info.Size = %d, want %d", info.Size, 1024*1024*50)
	}
	if len(info.Tables) != 2 {
		t.Errorf("Info.Tables length = %d, want 2", len(info.Tables))
	}
	if info.Tables["cache_machiaza"] != 100 {
		t.Errorf("Info.Tables[cache_machiaza] = %d, want 100", info.Tables["cache_machiaza"])
	}
}
