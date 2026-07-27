package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"

	"github.com/jackc/pgx/v5"

	commondb "abr.local/common/db"
)

// configKeyAnalyzePending is the abrdb_config key holding the JSON array of
// tables that were written by an import but whose post-import ANALYZE has not
// completed. Files flip to needs_import=false before ANALYZE runs, so without
// this marker a failed ANALYZE would leave the next dry-run reporting "no
// changes" and the statistics stale forever.
const configKeyAnalyzePending = "analyze_pending"

// PendingAnalyzeTables returns the persisted set of tables still awaiting
// ANALYZE. A missing key means none.
func (c *Catalog) PendingAnalyzeTables(ctx context.Context) ([]string, error) {
	var value string
	row := c.executor.QueryRow(ctx,
		"SELECT config_value FROM "+commondb.TableABRDBConfig+" WHERE config_key = $1", configKeyAnalyzePending)
	if err := row.Scan(&value); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("load pending analyze tables: %w", err)
	}

	var tables []string
	if err := json.Unmarshal([]byte(value), &tables); err != nil {
		return nil, fmt.Errorf("decode pending analyze tables %q: %w", value, err)
	}
	return tables, nil
}

// AddPendingAnalyzeTable records that tableName was written and still needs
// ANALYZE, merging with the persisted set. The read-modify-write is not
// transactional; writers run under the import advisory lock, so there is a
// single writer at a time.
func (c *Catalog) AddPendingAnalyzeTable(ctx context.Context, tableName string) error {
	tables, err := c.PendingAnalyzeTables(ctx)
	if err != nil {
		return err
	}
	if slices.Contains(tables, tableName) {
		return nil
	}
	encoded, err := json.Marshal(append(tables, tableName))
	if err != nil {
		return fmt.Errorf("encode pending analyze tables: %w", err)
	}
	return SaveConfigValue(ctx, c.executor, configKeyAnalyzePending, string(encoded))
}

// ClearPendingAnalyze removes the marker once ANALYZE has succeeded.
func (c *Catalog) ClearPendingAnalyze(ctx context.Context) error {
	if err := c.executor.Exec(ctx,
		"DELETE FROM "+commondb.TableABRDBConfig+" WHERE config_key = $1", configKeyAnalyzePending); err != nil {
		return fmt.Errorf("clear pending analyze tables: %w", err)
	}
	return nil
}
