package cache

import (
	"math"
	"os"
	"path/filepath"
	"testing"
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
