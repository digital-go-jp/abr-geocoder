package cache

import (
	"cmp"
	"context"
	"database/sql"
	"fmt"
	"strings"

	"abr.local/common/db"

	"abrg/internal/model"
)

// KeySchemaVersion is the cache_config key holding the DuckDB cache schema
// version. The key is written and read only by abrg, so it lives here rather
// than with the abrdb_config keys in common/db.
const KeySchemaVersion = "schema_version"

type Config struct {
	DBVersion       string
	EnabledPref     string
	EnabledCategory string
	EnabledPos      string
}

// PosEnabled reports whether the cache was built with position data enabled.
func (c *Config) PosEnabled() bool {
	return c.EnabledPos == "true"
}

// HasResidential reports whether the cache was built with residential
// (rsdtdsp) data. enabled_category is the source of truth for data
// availability; table presence is verified once at cache open.
func (c *Config) HasResidential() bool {
	return c.EnabledCategory == model.All || c.EnabledCategory == string(model.CategoryResidential)
}

// HasParcel reports whether the cache was built with parcel data.
func (c *Config) HasParcel() bool {
	return c.EnabledCategory == model.All || c.EnabledCategory == string(model.CategoryParcel)
}

// newConfig builds a Config from decoded abrdb config values. abrdb init
// parses pref and category case-insensitively (and treats an empty pref as
// all prefectures) but stores the raw input, so the values are canonicalized
// here — the single funnel both the DuckDB cache config and the PostgreSQL
// abrdb config pass through — and every consumer sees what abrdb meant.
func newConfig(decoded *db.ABRDBConfig) *Config {
	return &Config{
		DBVersion:       decoded.Version,
		EnabledPref:     cmp.Or(canonical(decoded.EnabledPref), model.All),
		EnabledCategory: canonical(decoded.EnabledCategory),
		EnabledPos:      decoded.EnabledPos,
	}
}

// canonical lowercases and trims a stored pref or category value.
func canonical(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

// loadConfigFromRows scans config key-value rows into a Config struct.
func loadConfigFromRows(rows *sql.Rows) (*Config, error) {
	decoded, err := db.ScanABRDBConfig(rows)
	if err != nil {
		return nil, err
	}
	return newConfig(decoded), nil
}

// loadConfigFromTable loads config from the specified config table.
func loadConfigFromTable(ctx context.Context, conn *sql.DB, table string) (*Config, error) {
	rows, err := conn.QueryContext(ctx, "SELECT config_key, config_value FROM "+table)
	if err != nil {
		return nil, fmt.Errorf("query %s: %w", table, err)
	}
	defer func() { _ = rows.Close() }()
	return loadConfigFromRows(rows)
}

func LoadConfig(ctx context.Context, conn *sql.DB) (*Config, error) {
	return loadConfigFromTable(ctx, conn, "cache_config")
}
