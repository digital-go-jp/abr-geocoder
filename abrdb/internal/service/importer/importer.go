// Package importer orchestrates the ABR data import process.
package importer

import (
	"context"
	"fmt"
	"log/slog"
	"path/filepath"
	"time"

	"abr.local/common/progress"

	"abrdb/internal/model"
	"abrdb/internal/schema"
	"abrdb/internal/service/catalog"
	"abrdb/internal/util"
)

// loader loads a text/position file pair for a category into the working store.
type loader interface {
	LoadData(ctx context.Context, categoryInfo *schema.CategoryInfo, textPath, posPath string) error
}

// catalogStore reads pending imports, clears previously imported rows,
// records completed imports, and refreshes statistics on imported tables.
type catalogStore interface {
	PendingImportsByCategory(ctx context.Context, categories []model.FileCategory) (map[model.FileCategory][]*model.File, error)
	TableIsEmpty(ctx context.Context, tableName string) (bool, error)
	DeleteFileScope(ctx context.Context, tableName, filename string) error
	EnsureLgCodeIndex(ctx context.Context, tableName string) error
	MarkAsImported(ctx context.Context, filenames ...string) error
	AnalyzeTables(ctx context.Context, tableNames []string) error
}

type service struct {
	loader          loader
	store           catalogStore
	progress        progress.Monitor
	downloadDir     string
	categoryInfoMap map[string]*schema.CategoryInfo
}

func New(
	loader loader,
	store catalogStore,
	progress progress.Monitor,
	downloadDir string,
	categoryInfoMap map[string]*schema.CategoryInfo,
) *service {
	return &service{
		loader:          loader,
		store:           store,
		progress:        progress,
		downloadDir:     downloadDir,
		categoryInfoMap: categoryInfoMap,
	}
}

// ImportCategoryBatch imports downloaded data for multiple category values into the database.
// Uses a single query to fetch all pending imports, eliminating N+1 queries.
// File pairs within each category are processed concurrently.
// Returns per-category timing in seconds for benchmark metrics.
func (s *service) ImportCategoryBatch(ctx context.Context, category []model.FileCategory) (map[string]float64, error) {
	if len(category) == 0 {
		return make(map[string]float64), nil
	}

	// Single query to get all pending imports for all category
	pendingByCategory, err := s.store.PendingImportsByCategory(ctx, category)
	if err != nil {
		return nil, fmt.Errorf("get pending imports: %w", err)
	}

	phaseTimes := make(map[string]float64)

	// Tables written by this run, deduplicated in category order, for the
	// post-import ANALYZE.
	var updatedTables []string
	seenTables := make(map[string]struct{})

	// Process each category with timing
	for _, cat := range category {
		pendingFiles := pendingByCategory[cat]
		if len(pendingFiles) == 0 {
			continue
		}

		categoryInfo := s.categoryInfoMap[string(cat)]
		if categoryInfo == nil {
			return nil, fmt.Errorf("no category info for %q", cat)
		}

		pairs := catalog.GroupFilesByPairKey(pendingFiles)
		slog.Debug("importing file pairs", "event", "import_pairs", "category", cat, "pair_count", len(pairs))

		// Initial build into an empty table has nothing to delete. Skipping the
		// deletes also lets the lg_code index be created after the bulk insert
		// (below) instead of being maintained row by row during it.
		tableEmpty, err := s.store.TableIsEmpty(ctx, categoryInfo.TableName)
		if err != nil {
			return nil, fmt.Errorf("check %q is empty: %w", categoryInfo.TableName, err)
		}

		categoryStart := time.Now()
		taskName := fmt.Sprintf("Importing %s", cat)
		if err := util.ExecuteConcurrently(ctx, pairs, func(ctx context.Context, pair catalog.FilePairing) error {
			return s.importFilePair(ctx, pair, categoryInfo, !tableEmpty)
		}, s.progress, taskName); err != nil {
			return nil, fmt.Errorf("import files for %q: %w", cat, err)
		}

		if err := s.store.EnsureLgCodeIndex(ctx, categoryInfo.TableName); err != nil {
			return nil, fmt.Errorf("ensure lg_code index on %q: %w", categoryInfo.TableName, err)
		}
		phaseTimes[string(cat)] = time.Since(categoryStart).Seconds()

		if _, seen := seenTables[categoryInfo.TableName]; !seen {
			seenTables[categoryInfo.TableName] = struct{}{}
			updatedTables = append(updatedTables, categoryInfo.TableName)
		}
	}

	// Refresh statistics once every category has imported successfully, while
	// the caller still holds the import lock. Stale statistics after a bulk
	// import derail the subsequent `abrg cache build` (see Catalog.AnalyzeTables),
	// so an ANALYZE failure fails the import.
	if len(updatedTables) > 0 {
		start := time.Now()
		if err := s.store.AnalyzeTables(ctx, updatedTables); err != nil {
			return nil, fmt.Errorf("analyze imported tables: %w", err)
		}
		slog.Info("post-import analyze completed", "event", "analyze",
			"tables", updatedTables, "total_sec", time.Since(start).Seconds())
	}

	return phaseTimes, nil
}

func (s *service) importFilePair(ctx context.Context, pair catalog.FilePairing, categoryInfo *schema.CategoryInfo, deleteFirst bool) error {
	textPath := filepath.Join(s.downloadDir, pair.TextFile.Filename)
	var posPath string
	if pair.PosFile != nil {
		posPath = filepath.Join(s.downloadDir, pair.PosFile.Filename)
	}

	// Delete directly on PostgreSQL: the same DELETE through the DuckDB
	// postgres extension scans the remote table per statement. Idempotent, and
	// needs_import stays set until MarkAsImported, so a failure between delete
	// and load is repaired by re-running the import.
	if deleteFirst {
		if err := s.store.DeleteFileScope(ctx, categoryInfo.TableName, pair.TextFile.Filename); err != nil {
			return fmt.Errorf("delete previous rows: %w", err)
		}
	}

	if err := s.loader.LoadData(ctx, categoryInfo, textPath, posPath); err != nil {
		return fmt.Errorf("load data: %w", err)
	}

	filenames := []string{pair.TextFile.Filename}
	if pair.PosFile != nil {
		filenames = append(filenames, pair.PosFile.Filename)
	}
	return s.store.MarkAsImported(ctx, filenames...)
}
