package postgres

import (
	"context"
	"fmt"
	"strconv"

	commondb "abr.local/common/db"

	"abrdb/internal/infra/db"
)

// SaveConfigValue upserts a single key/value into abrdb_config.
func SaveConfigValue(ctx context.Context, executor *db.QueryExecutor, key, value string) error {
	const q = `
        INSERT INTO abrdb_config (config_key, config_value)
        VALUES ($1, $2)
        ON CONFLICT (config_key)
        DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = CURRENT_TIMESTAMP
    `
	if err := executor.Exec(ctx, q, key, value); err != nil {
		return fmt.Errorf("save config %q: %w", key, err)
	}
	return nil
}

// SaveInitConfig stores initialization inputs as-is (not expanded),
// so later runs can rehydrate the original intent.
func SaveInitConfig(ctx context.Context, executor *db.QueryExecutor, prefInput, categoryInput string, enablePos bool, importConfigYAML string) error {
	if err := SaveConfigValue(ctx, executor, commondb.KeyEnabledPref, prefInput); err != nil {
		return fmt.Errorf("save enabled pref: %w", err)
	}
	if err := SaveConfigValue(ctx, executor, commondb.KeyEnabledCategory, categoryInput); err != nil {
		return fmt.Errorf("save enabled category: %w", err)
	}
	if err := SaveConfigValue(ctx, executor, commondb.KeyEnabledPos, strconv.FormatBool(enablePos)); err != nil {
		return fmt.Errorf("save enable position data: %w", err)
	}
	if err := SaveConfigValue(ctx, executor, commondb.KeyImportConfig, importConfigYAML); err != nil {
		return fmt.Errorf("save import config: %w", err)
	}
	return nil
}

// SaveVersion stores the application version.
func SaveVersion(ctx context.Context, executor *db.QueryExecutor, version string) error {
	return SaveConfigValue(ctx, executor, commondb.KeyABRDBVersion, version)
}
