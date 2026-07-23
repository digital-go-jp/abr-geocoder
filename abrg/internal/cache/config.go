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

// loadConfigFromRows scans config key-value rows into a Config struct.
func loadConfigFromRows(rows *sql.Rows) (*Config, error) {
	cfg := &Config{}
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			return nil, fmt.Errorf("scan config row: %w", err)
		}
		switch key {
		case db.KeyABRDBVersion:
			cfg.DBVersion = value
		case db.KeyEnabledCategory:
			cfg.EnabledCategory = value
		case db.KeyEnabledPref:
			cfg.EnabledPref = value
		case db.KeyEnabledPos:
			cfg.EnabledPos = value
		}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate config rows: %w", err)
	}
	return cfg, nil
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
