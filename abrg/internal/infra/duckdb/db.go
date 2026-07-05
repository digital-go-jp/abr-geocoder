// Package duckdb provides DuckDB utilities for abrg.
package duckdb

import (
	"database/sql"
	"errors"
	"fmt"
	"io/fs"
	"os"

	"abr.local/common/duck"
)

const EnvCachePath = "CACHE_PATH"

const (
	tableMachiaza = "cache_machiaza"
	tableCity     = "cache_city"
	tablePref     = "cache_pref"

	TableRsdtdsp = "cache_rsdtdsp"
	TableParcel  = "cache_parcel"
)

var AllTables = []string{tablePref, tableCity, tableMachiaza, TableRsdtdsp, TableParcel}

// ResolvePath resolves cache path from flag value or config value.
// Priority: flagValue > configValue. Returns empty string if neither is set.
func ResolvePath(flagValue, configValue string) string {
	if flagValue != "" {
		return flagValue
	}
	return configValue
}

// Open opens a DuckDB connection to the given path.
func Open(path string) (*sql.DB, error) {
	return duck.Open(path)
}

// OpenReadOnly opens a read-only DuckDB connection.
// Returns error if the file does not exist.
func OpenReadOnly(path string) (*sql.DB, error) {
	if _, err := os.Stat(path); errors.Is(err, fs.ErrNotExist) {
		return nil, fmt.Errorf("cache file not found: %s", path)
	}
	return Open(path + "?access_mode=read_only")
}
