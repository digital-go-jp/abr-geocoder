package db

import (
	"context"
	"fmt"

	commondb "abr.local/common/db"
)

// LoadABRDBConfig loads configuration from the abrdb_config table
func LoadABRDBConfig(ctx context.Context, executor *QueryExecutor) (*commondb.ABRDBConfig, error) {
	query := `SELECT config_key, config_value FROM ` + commondb.TableABRDBConfig + ` ORDER BY config_key`
	rows, err := executor.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query config: %w", err)
	}
	defer rows.Close()

	return commondb.ScanABRDBConfig(rows)
}
