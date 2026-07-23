package duckdb

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestResolvePath(t *testing.T) {
	tests := []struct {
		name      string
		flagValue string
		cfgValue  string
		want      string
	}{
		{name: "flag wins over config", flagValue: "/flag.duckdb", cfgValue: "/cfg.duckdb", want: "/flag.duckdb"},
		{name: "config used when flag empty", flagValue: "", cfgValue: "/cfg.duckdb", want: "/cfg.duckdb"},
		{name: "flag used when config empty", flagValue: "/flag.duckdb", cfgValue: "", want: "/flag.duckdb"},
		{name: "both empty yields empty", flagValue: "", cfgValue: "", want: ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ResolvePath(tt.flagValue, tt.cfgValue); got != tt.want {
				t.Errorf("ResolvePath(%q, %q) = %q, want %q", tt.flagValue, tt.cfgValue, got, tt.want)
			}
		})
	}
}

func TestOpenReadOnly_MissingFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "does-not-exist.duckdb")

	db, err := OpenReadOnly(path)
	if db != nil {
		_ = db.Close()
		t.Fatal("db should be nil when the cache file is missing")
	}
	if err == nil {
		t.Fatal("want error for a missing cache file, got nil")
	}
	if !strings.Contains(err.Error(), "cache file not found") {
		t.Errorf("error = %q, want it to mention 'cache file not found'", err)
	}
}

func TestOpenReadOnly_ExistingFileIsReadOnly(t *testing.T) {
	path := filepath.Join(t.TempDir(), "cache.duckdb")

	// Materialise a real on-disk DuckDB file with one row.
	writeDB, err := Open(path)
	if err != nil {
		t.Fatalf("Open (write): %v", err)
	}
	if _, err := writeDB.ExecContext(t.Context(), `CREATE TABLE t (id INTEGER); INSERT INTO t VALUES (1)`); err != nil {
		t.Fatalf("seed data: %v", err)
	}
	if err := writeDB.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}

	db, err := OpenReadOnly(path)
	if err != nil {
		t.Fatalf("OpenReadOnly: %v", err)
	}
	defer func() { _ = db.Close() }()

	// The connection must be genuinely usable for reads.
	var n int
	if err := db.QueryRowContext(t.Context(), `SELECT id FROM t`).Scan(&n); err != nil {
		t.Fatalf("read query: %v", err)
	}
	if n != 1 {
		t.Errorf("read id = %d, want 1", n)
	}

	// read_only must actually be applied: a write has to be rejected. This fails
	// if the "?access_mode=read_only" suffix is ever dropped from OpenReadOnly.
	if _, err := db.ExecContext(t.Context(), `INSERT INTO t VALUES (2)`); err == nil {
		t.Error("write succeeded on a read-only connection, want it rejected")
	}
}
