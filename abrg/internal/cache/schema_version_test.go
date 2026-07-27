package cache

import (
	"context"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"abr.local/common/duck"

	"abrg/internal/infra/duckdb"
	"abrg/internal/schema"
)

// newTestCacheFile creates a DuckDB file with the YAML cache schema (empty
// tables) and the given cache_config rows, executes any extra DDL (e.g. stub
// category tables), then closes it so it can be reopened read-only.
func newTestCacheFile(t *testing.T, configRows map[string]string, extraSQL ...string) string {
	t.Helper()
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "test.duckdb")

	conn, err := duckdb.Open(path)
	if err != nil {
		t.Fatalf("open duckdb: %v", err)
	}
	defer func() { _ = conn.Close() }()

	initSQL, err := schema.InitSchemaSQL()
	if err != nil {
		t.Fatalf("generate schema SQL: %v", err)
	}
	if _, err := conn.ExecContext(ctx, initSQL); err != nil {
		t.Fatalf("init schema: %v", err)
	}
	for key, value := range configRows {
		if _, err := conn.ExecContext(ctx,
			"INSERT INTO cache_config (config_key, config_value) VALUES (?, ?)", key, value); err != nil {
			t.Fatalf("insert config row %s: %v", key, err)
		}
	}
	for _, stmt := range extraSQL {
		if _, err := conn.ExecContext(ctx, stmt); err != nil {
			t.Fatalf("execute extra SQL: %v", err)
		}
	}
	if err := conn.Close(); err != nil {
		t.Fatalf("close duckdb: %v", err)
	}
	return path
}

func TestNewDuckDBCacheFromPath_SchemaVersion(t *testing.T) {
	ctx := context.Background()
	current, err := schema.Version()
	if err != nil {
		t.Fatalf("schema.Version(): %v", err)
	}

	t.Run("matching version opens", func(t *testing.T) {
		path := newTestCacheFile(t, map[string]string{KeySchemaVersion: strconv.Itoa(current)})
		c, err := NewDuckDBCacheFromPath(ctx, path)
		if err != nil {
			t.Fatalf("NewDuckDBCacheFromPath() error = %v, want nil", err)
		}
		_ = c.Close()
	})

	t.Run("missing version is rejected", func(t *testing.T) {
		path := newTestCacheFile(t, nil)
		_, err := NewDuckDBCacheFromPath(ctx, path)
		if err == nil {
			t.Fatal("NewDuckDBCacheFromPath() = nil, want error")
		}
		for _, want := range []string{"cache has no schema version", "abrg cache build"} {
			if !strings.Contains(err.Error(), want) {
				t.Errorf("error %q does not contain %q", err, want)
			}
		}
	})

	t.Run("mismatched version is rejected", func(t *testing.T) {
		path := newTestCacheFile(t, map[string]string{KeySchemaVersion: "999"})
		_, err := NewDuckDBCacheFromPath(ctx, path)
		if err == nil {
			t.Fatal("NewDuckDBCacheFromPath() = nil, want error")
		}
		wantVersions := "cache schema version 999, binary requires " + strconv.Itoa(current)
		for _, want := range []string{wantVersions, "abrg cache build"} {
			if !strings.Contains(err.Error(), want) {
				t.Errorf("error %q does not contain %q", err, want)
			}
		}
	})
}

func TestSaveConfigToCache_WritesSchemaVersion(t *testing.T) {
	ctx := context.Background()
	current, err := schema.Version()
	if err != nil {
		t.Fatalf("schema.Version(): %v", err)
	}

	conn, err := duck.Open("")
	if err != nil {
		t.Fatalf("open in-memory duckdb: %v", err)
	}
	defer func() { _ = conn.Close() }()

	initSQL, err := schema.InitSchemaSQL()
	if err != nil {
		t.Fatalf("generate schema SQL: %v", err)
	}
	if _, err := conn.ExecContext(ctx, initSQL); err != nil {
		t.Fatalf("init schema: %v", err)
	}

	cfg := &Config{DBVersion: "3.0.0", EnabledPref: "13", EnabledCategory: "basic", EnabledPos: "true"}
	if err := saveConfigToCache(ctx, conn, cfg); err != nil {
		t.Fatalf("saveConfigToCache() error = %v", err)
	}

	var got string
	if err := conn.QueryRowContext(ctx,
		"SELECT config_value FROM cache_config WHERE config_key = ?", KeySchemaVersion).Scan(&got); err != nil {
		t.Fatalf("read schema_version: %v", err)
	}
	if want := strconv.Itoa(current); got != want {
		t.Errorf("schema_version = %q, want %q", got, want)
	}

	// schema_version is the completion marker and must be written last, so
	// a build that dies partway leaves a cache the version check rejects.
	// DuckDB scans this freshly inserted single-row-group table in insertion
	// order, which makes the write order observable.
	rows, err := conn.QueryContext(ctx, "SELECT config_key FROM cache_config")
	if err != nil {
		t.Fatalf("read config keys: %v", err)
	}
	defer func() { _ = rows.Close() }()
	var last string
	for rows.Next() {
		if err := rows.Scan(&last); err != nil {
			t.Fatalf("scan config key: %v", err)
		}
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate config keys: %v", err)
	}
	if last != KeySchemaVersion {
		t.Errorf("last written config key = %q, want %q (completion marker must be last)", last, KeySchemaVersion)
	}
}
