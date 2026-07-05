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

// catalogStore reads pending imports and records completed ones.
type catalogStore interface {
	PendingImportsByCategory(ctx context.Context, categories []model.FileCategory) (map[model.FileCategory][]*model.File, error)
	MarkAsImported(ctx context.Context, filenames ...string) error
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

		categoryStart := time.Now()
		taskName := fmt.Sprintf("Importing %s", cat)
		if err := util.ExecuteConcurrently(ctx, pairs, func(ctx context.Context, pair catalog.FilePairing) error {
			return s.importFilePair(ctx, pair, categoryInfo)
		}, s.progress, taskName); err != nil {
			return nil, fmt.Errorf("import files for %q: %w", cat, err)
		}
		phaseTimes[string(cat)] = time.Since(categoryStart).Seconds()
	}

	return phaseTimes, nil
}

func (s *service) importFilePair(ctx context.Context, pair catalog.FilePairing, categoryInfo *schema.CategoryInfo) error {
	textPath := filepath.Join(s.downloadDir, pair.TextFile.Filename)
	var posPath string
	if pair.PosFile != nil {
		posPath = filepath.Join(s.downloadDir, pair.PosFile.Filename)
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
