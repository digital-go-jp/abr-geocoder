package cache

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"

	"abrg/internal/infra/duckdb"
)

type Info struct {
	Path          string
	Size          int64
	BuildTime     string // Build time from cache_config
	SchemaVersion string // Schema version from cache_config; empty if absent
	Tables        map[string]int
}

const bytesPerMB = 1024 * 1024

func (i *Info) SizeMB() float64 {
	return float64(i.Size) / bytesPerMB
}

// FileInfo retrieves basic file information about a cache file without opening the database.
// Use this for quick validation before starting the server.
func FileInfo(cachePath string) (*Info, error) {
	fi, err := os.Stat(cachePath)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, fmt.Errorf("cache file not found: %s", cachePath)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to access cache file: %w", err)
	}
	return &Info{
		Path: cachePath,
		Size: fi.Size(),
	}, nil
}

// LoadInfo retrieves cache information by opening the cache file read-only.
func LoadInfo(ctx context.Context, cachePath string) (*Info, error) {
	info, err := FileInfo(cachePath)
	if err != nil {
		return nil, err
	}

	conn, err := duckdb.OpenReadOnly(cachePath)
	if err != nil {
		return nil, err
	}
	defer func() { _ = conn.Close() }()

	info.Tables = make(map[string]int, len(duckdb.AllTables))

	// BuildTime and SchemaVersion are optional; zero value on failure.
	_ = conn.QueryRowContext(ctx, "SELECT config_value FROM cache_config WHERE config_key = 'build_time'").Scan(&info.BuildTime)
	_ = conn.QueryRowContext(ctx, "SELECT config_value FROM cache_config WHERE config_key = ?", KeySchemaVersion).Scan(&info.SchemaVersion)

	// Table names are trusted constants from duckdb.AllTables.
	// Negative count means the row count is unavailable.
	for _, table := range duckdb.AllTables {
		var count int
		query := fmt.Sprintf("SELECT COUNT(*) FROM %s", table)
		if err := conn.QueryRowContext(ctx, query).Scan(&count); err != nil {
			info.Tables[table] = -1
		} else {
			info.Tables[table] = count
		}
	}

	return info, nil
}
