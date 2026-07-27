package postgres

import (
	"context"
	"fmt"
	"strings"

	"abrdb/internal/infra/db"

	"abrdb/internal/model"
)

// lightweight interface to share Scan between *sql.Row and *sql.Rows
type scanner interface{ Scan(dest ...any) error }

const fileSelectColumns = `
        file_type, file_category, pref_code, file_key,
        filename,
        last_modified, source_url,
        needs_download, needs_import, updated_at
`

func scanFile(s scanner, f *model.File) error {
	return s.Scan(
		&f.FileType, &f.FileCategory, &f.PrefCode, &f.FileKey,
		&f.Filename,
		&f.LastModified, &f.SourceURL,
		&f.NeedsDownload, &f.NeedsImport, &f.UpdatedAt,
	)
}

// Catalog persists the abrdb_catalog file inventory and the import state of
// the imported data tables.
type Catalog struct {
	executor *db.QueryExecutor
}

// NewCatalog creates a Catalog backed by the given executor.
func NewCatalog(executor *db.QueryExecutor) *Catalog {
	return &Catalog{executor: executor}
}

// UpsertFile inserts or updates a file record.
// updated_at is only changed when actual data changes occur.
func (c *Catalog) UpsertFile(ctx context.Context, record *model.File) error {
	err := c.executor.Exec(ctx, `
		INSERT INTO abrdb_catalog (
			file_type, file_category, pref_code, file_key,
			filename,
			last_modified, source_url,
			needs_download, needs_import, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP
		)
		ON CONFLICT (filename) DO UPDATE SET
			file_type = EXCLUDED.file_type,
			file_category = EXCLUDED.file_category,
			pref_code = EXCLUDED.pref_code,
			file_key = EXCLUDED.file_key,
			last_modified = EXCLUDED.last_modified,
			source_url = EXCLUDED.source_url,
			needs_download = EXCLUDED.needs_download,
			needs_import = EXCLUDED.needs_import,
			updated_at = CASE
				WHEN abrdb_catalog.last_modified != EXCLUDED.last_modified
				  OR abrdb_catalog.needs_download != EXCLUDED.needs_download
				  OR abrdb_catalog.needs_import != EXCLUDED.needs_import
				THEN CURRENT_TIMESTAMP
				ELSE abrdb_catalog.updated_at
			END
	`,
		record.FileType, record.FileCategory, record.PrefCode, record.FileKey,
		record.Filename,
		record.LastModified, record.SourceURL,
		record.NeedsDownload, record.NeedsImport,
	)
	if err != nil {
		return fmt.Errorf("upsert file %s: %w", record.Filename, err)
	}
	return nil
}

// FilesToDownload retrieves files that need downloading.
func (c *Catalog) FilesToDownload(ctx context.Context) ([]*model.File, error) {
	return c.queryFiles(ctx, "WHERE needs_download = true")
}

// AllPendingImports retrieves all files that still need importing (needs_import=true),
// regardless of category. Used by the download phase to detect catalog/disk drift:
// a file may be flagged for import but missing on disk (e.g., on ephemeral storage
// like ECS Fargate /tmp), and must be re-downloaded.
func (c *Catalog) AllPendingImports(ctx context.Context) ([]*model.File, error) {
	return c.queryFiles(ctx, "WHERE needs_import = true")
}

// PendingImportsByCategory retrieves files pending import for multiple category values in one query.
// Returns a map of category to files, eliminating N+1 queries when importing multiple category values.
func (c *Catalog) PendingImportsByCategory(ctx context.Context, category []model.FileCategory) (map[model.FileCategory][]*model.File, error) {
	result := make(map[model.FileCategory][]*model.File)
	if len(category) == 0 {
		return result, nil
	}

	files, err := c.queryFiles(ctx, "WHERE needs_import = true AND file_category = ANY($1)", category)
	if err != nil {
		return nil, err
	}
	for _, f := range files {
		result[f.FileCategory] = append(result[f.FileCategory], f)
	}
	return result, nil
}

// FilesByCategory retrieves all files for a category as a map keyed by source URL.
func (c *Catalog) FilesByCategory(ctx context.Context, category model.FileCategory) (map[string]*model.File, error) {
	files, err := c.queryFiles(ctx, "WHERE file_category = $1", category)
	if err != nil {
		return nil, err
	}
	result := make(map[string]*model.File, len(files))
	for _, f := range files {
		result[f.SourceURL] = f
	}
	return result, nil
}

// queryFiles is a helper to query files with conditions
func (c *Catalog) queryFiles(ctx context.Context, whereClause string, args ...any) ([]*model.File, error) {
	query := `
        SELECT ` + fileSelectColumns + `
        FROM abrdb_catalog
        ` + whereClause

	rows, err := c.executor.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query files: %w", err)
	}
	defer rows.Close()

	var files []*model.File
	for rows.Next() {
		var f model.File
		if err := scanFile(rows, &f); err != nil {
			return nil, fmt.Errorf("scan file: %w", err)
		}
		files = append(files, &f)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate files: %w", err)
	}
	return files, nil
}

// MarkAsDownloaded marks a file as downloaded and ready for import.
func (c *Catalog) MarkAsDownloaded(ctx context.Context, filename string) error {
	return c.updateFileStatus(ctx, false, true, filename)
}

// MarkAsImported marks one or two files as fully imported.
// Accepts 1-2 filenames for convenience when handling text/pos pairs.
func (c *Catalog) MarkAsImported(ctx context.Context, filenames ...string) error {
	return c.updateFileStatus(ctx, false, false, filenames...)
}

// updateFileStatus updates the download/import status for one or more files.
func (c *Catalog) updateFileStatus(ctx context.Context, needsDownload, needsImport bool, filenames ...string) error {
	if len(filenames) == 0 {
		return nil
	}

	placeholders := make([]string, len(filenames))
	args := []any{needsDownload, needsImport}
	for i, f := range filenames {
		placeholders[i] = fmt.Sprintf("$%d", i+3)
		args = append(args, f)
	}

	query := fmt.Sprintf(`
		UPDATE abrdb_catalog
		SET needs_download = $1, needs_import = $2, updated_at = CURRENT_TIMESTAMP
		WHERE filename IN (%s)
	`, strings.Join(placeholders, ", "))

	err := c.executor.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("update file status: %w", err)
	}
	return nil
}

// PendingSummary holds counts of pending operations per category.
type PendingSummary struct {
	Category      model.FileCategory
	DownloadCount int
	ImportCount   int
}

func (c *Catalog) GetPendingSummary(ctx context.Context) ([]PendingSummary, error) {
	rows, err := c.executor.Query(ctx, `
		SELECT
			file_category,
			COUNT(*) FILTER (WHERE needs_download) AS download_count,
			COUNT(*) FILTER (WHERE needs_import AND file_type = 'text') AS import_count
		FROM abrdb_catalog
		GROUP BY file_category
		HAVING COUNT(*) FILTER (WHERE needs_download) > 0
		    OR COUNT(*) FILTER (WHERE needs_import AND file_type = 'text') > 0
		ORDER BY file_category
	`)
	if err != nil {
		return nil, fmt.Errorf("get pending summary: %w", err)
	}
	defer rows.Close()

	var results []PendingSummary
	for rows.Next() {
		var s PendingSummary
		if err := rows.Scan(&s.Category, &s.DownloadCount, &s.ImportCount); err != nil {
			return nil, fmt.Errorf("scan pending summary: %w", err)
		}
		results = append(results, s)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate pending summary: %w", err)
	}
	return results, nil
}

// CountOrphanPosFiles counts pending pos files that have no text counterpart
// in the catalog. The feed publishes such files for a few municipalities;
// imports always start from the text file, so these rows stay needs_import
// forever and never appear in the pending summary.
func (c *Catalog) CountOrphanPosFiles(ctx context.Context) (int, error) {
	var count int
	err := c.executor.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM abrdb_catalog p
		WHERE p.file_type = 'pos'
		  AND p.needs_import
		  AND NOT EXISTS (
			SELECT 1 FROM abrdb_catalog t
			WHERE t.file_key = p.file_key
			  AND t.file_category = p.file_category
			  AND t.file_type = 'text'
		  )
	`).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count orphan pos files: %w", err)
	}
	return count, nil
}

// SyncPairImportStatus synchronizes needs_import flag between text/pos pairs.
// If either file in a pair has needs_import=true, both are set to true.
// This ensures that text and pos files are always imported together.
func (c *Catalog) SyncPairImportStatus(ctx context.Context) error {
	err := c.executor.Exec(ctx, `
		UPDATE abrdb_catalog AS target
		SET needs_import = true, updated_at = CURRENT_TIMESTAMP
		WHERE needs_import = false
		  AND EXISTS (
			SELECT 1 FROM abrdb_catalog AS pair
			WHERE pair.file_key = target.file_key
			  AND pair.file_category = target.file_category
			  AND pair.file_type != target.file_type
			  AND pair.needs_import = true
		  )
	`)
	if err != nil {
		return fmt.Errorf("sync pair import status: %w", err)
	}
	return nil
}
