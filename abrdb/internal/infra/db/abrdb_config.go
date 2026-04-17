package db

import (
	"context"
	"fmt"

	commondb "abr.local/common/db"
)

// ABRDBConfig represents configuration loaded from abrdb_config table
type ABRDBConfig struct {
	Version          string
	EnabledPref      string
	EnabledCategory  string
	EnabledPos       string
	ImportConfigYAML string
}

// LoadABRDBConfig loads configuration from the abrdb_config table
func LoadABRDBConfig(ctx context.Context, executor *QueryExecutor) (*ABRDBConfig, error) {
	config := &ABRDBConfig{}

	query := `SELECT config_key, config_value FROM abrdb_config ORDER BY config_key`
	rows, err := executor.Pool().Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query config: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			return nil, fmt.Errorf("scan config row: %w", err)
		}

		switch key {
		case commondb.KeyABRDBVersion:
			config.Version = value
		case commondb.KeyEnabledPref:
			config.EnabledPref = value
		case commondb.KeyEnabledCategory:
			config.EnabledCategory = value
		case commondb.KeyEnabledPos:
			config.EnabledPos = value
		case commondb.KeyImportConfig:
			config.ImportConfigYAML = value
		}
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate config rows: %w", err)
	}

	return config, nil
}
