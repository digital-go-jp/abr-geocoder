package cache

import (
	"context"
	"database/sql"
	"fmt"

	"abr.local/common/db"
)

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

// loadConfigFromRows scans config key-value rows into a Config struct.
func loadConfigFromRows(rows *sql.Rows) (*Config, error) {
	decoded, err := db.ScanABRDBConfig(rows)
	if err != nil {
		return nil, err
	}
	return &Config{
		DBVersion:       decoded.Version,
		EnabledPref:     decoded.EnabledPref,
		EnabledCategory: decoded.EnabledCategory,
		EnabledPos:      decoded.EnabledPos,
	}, nil
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
