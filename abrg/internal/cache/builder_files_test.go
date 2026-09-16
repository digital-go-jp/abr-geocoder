package cache

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"testing"
)

func TestRemoveCacheFiles(t *testing.T) {
	path := filepath.Join(t.TempDir(), "abrg.duckdb.tmp")
	files := []string{path, path + ".wal"}
	for _, p := range files {
		if err := os.WriteFile(p, []byte("stale"), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	if err := removeCacheFiles(path); err != nil {
		t.Fatalf("removeCacheFiles() error = %v, want nil", err)
	}
	for _, p := range files {
		if _, err := os.Stat(p); !errors.Is(err, fs.ErrNotExist) {
			t.Errorf("%s still exists (stat error = %v)", p, err)
		}
	}

	if err := removeCacheFiles(path); err != nil {
		t.Errorf("removeCacheFiles() on missing files error = %v, want nil", err)
	}
}
