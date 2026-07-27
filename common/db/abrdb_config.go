package db

import "fmt"

// TableABRDBConfig is the PostgreSQL table that stores abrdb settings as
// config_key/config_value rows.
const TableABRDBConfig = "abrdb_config"

// ABRDBConfig holds the settings stored in the abrdb_config table.
type ABRDBConfig struct {
	Version             string
	EnabledPref         string
	EnabledCategory     string
	EnabledPos          string
	ImportConfigProfile string
}

// ConfigRows is the minimal row iterator satisfied by both pgx.Rows and
// *database/sql.Rows. Closing the rows remains the caller's responsibility.
type ConfigRows interface {
	Next() bool
	Scan(dest ...any) error
	Err() error
}

// ScanABRDBConfig decodes config_key/config_value rows into an ABRDBConfig.
// Unknown keys are ignored.
func ScanABRDBConfig(rows ConfigRows) (*ABRDBConfig, error) {
	config := &ABRDBConfig{}
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			return nil, fmt.Errorf("scan config row: %w", err)
		}
		switch key {
		case KeyABRDBVersion:
			config.Version = value
		case KeyEnabledPref:
			config.EnabledPref = value
		case KeyEnabledCategory:
			config.EnabledCategory = value
		case KeyEnabledPos:
			config.EnabledPos = value
		case KeyImportConfigProfile:
			config.ImportConfigProfile = value
		}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate config rows: %w", err)
	}
	return config, nil
}
