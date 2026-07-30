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
	PendingAnalyzeTables(ctx context.Context) ([]string, error)
	AddPendingAnalyzeTable(ctx context.Context, tableName string) error
	ClearPendingAnalyze(ctx context.Context) error
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

// startStage shows an elapsed-time line while a step that prints nothing of its
// own runs, and returns the function that takes the line off the screen. A nil
// s.progress means the progress display is off, so nothing is shown.
func (s *service) startStage(name string) func() {
	if s.progress == nil {
		return func() {}
	}
	return s.progress.StartStage(name)
}

// ensureLgCodeIndex builds the index the delete conditions need, showing how
// long it takes: on a freshly loaded table it runs without output of its own.
func (s *service) ensureLgCodeIndex(ctx context.Context, tableName string) error {
	defer s.startStage("Indexing " + tableName)()
	return s.store.EnsureLgCodeIndex(ctx, tableName)
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

	// One read for the whole run: the limit is a process setting, and reading it
	// is what reports an invalid value to the operator.
	limit := util.LoadConcurrency().Import

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

		// Orphan pos files without a text counterpart (a known ABR feed state)
		// form no importable pair: nothing is written, so the table must not
		// be marked updated or re-analyzed.
		if len(pairs) == 0 {
			continue
		}

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
		}, s.progress, taskName, limit); err != nil {
			return nil, fmt.Errorf("import files for %q: %w", cat, err)
		}

		if err := s.ensureLgCodeIndex(ctx, categoryInfo.TableName); err != nil {
			return nil, fmt.Errorf("ensure lg_code index on %q: %w", categoryInfo.TableName, err)
		}
		phaseTimes[string(cat)] = time.Since(categoryStart).Seconds()

		if _, seen := seenTables[categoryInfo.TableName]; !seen {
			seenTables[categoryInfo.TableName] = struct{}{}
			updatedTables = append(updatedTables, categoryInfo.TableName)
		}
		// Persist the ANALYZE obligation as soon as the table is written: the
		// files are already marked imported, so only this marker lets a later
		// run redo an ANALYZE that fails or never runs.
		if err := s.store.AddPendingAnalyzeTable(ctx, categoryInfo.TableName); err != nil {
			return nil, fmt.Errorf("record pending analyze for %q: %w", categoryInfo.TableName, err)
		}
	}

	if err := s.analyzePending(ctx, updatedTables, seenTables); err != nil {
		return nil, err
	}

	return phaseTimes, nil
}

// analyzePending refreshes statistics once every category has imported
// successfully, while the caller still holds the import lock. The target is
// this run's tables plus the persisted backlog left by earlier runs whose
// ANALYZE failed. Stale statistics after a bulk import derail the subsequent
// `abrg cache build` (see Catalog.AnalyzeTables), so an ANALYZE failure fails
// the import; the persisted marker is only cleared after success.
func (s *service) analyzePending(ctx context.Context, updatedTables []string, seenTables map[string]struct{}) error {
	persisted, err := s.store.PendingAnalyzeTables(ctx)
	if err != nil {
		return fmt.Errorf("load pending analyze tables: %w", err)
	}
	analyzeTables := updatedTables
	for _, table := range persisted {
		if _, seen := seenTables[table]; !seen {
			seenTables[table] = struct{}{}
			analyzeTables = append(analyzeTables, table)
		}
	}
	if len(analyzeTables) == 0 {
		return nil
	}

	defer s.startStage("Analyzing tables")()

	start := time.Now()
	if err := s.store.AnalyzeTables(ctx, analyzeTables); err != nil {
		return fmt.Errorf("analyze imported tables: %w", err)
	}
	if err := s.store.ClearPendingAnalyze(ctx); err != nil {
		return fmt.Errorf("clear pending analyze marker: %w", err)
	}
	slog.Info("post-import analyze completed", "event", "analyze",
		"tables", analyzeTables, "total_sec", time.Since(start).Seconds())
	return nil
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
