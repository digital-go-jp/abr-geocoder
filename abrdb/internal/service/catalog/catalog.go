package catalog

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"maps"
	"os"
	"slices"
	"strings"

	"abrdb/internal/infra/api"
	"abrdb/internal/model"
	"abrdb/internal/schema"
)

// apiLister lists catalog files from the DCAT feed.
type apiLister interface {
	ListFilesByPrefix(ctx context.Context, prefix string) ([]api.FileInfo, error)
}

// catalogStore persists catalog rows.
type catalogStore interface {
	FilesByCategory(ctx context.Context, category model.FileCategory) (map[string]*model.File, error)
	UpsertFile(ctx context.Context, record *model.File) error
	SyncPairImportStatus(ctx context.Context) error
}

type ServiceConfig struct {
	APIClient       apiLister
	Store           catalogStore
	DownloadDir     string
	EnabledPref     []int
	EnabledCategory map[model.FileCategory]bool
	EnabledPos      bool
	CategoryInfoMap map[string]*schema.CategoryInfo
}

type service struct {
	apiClient       apiLister
	store           catalogStore
	downloadDir     string
	enabledPref     []int
	enabledCategory map[model.FileCategory]bool
	enabledPos      bool
	categoryInfoMap map[string]*schema.CategoryInfo
}

func New(cfg ServiceConfig) *service {
	return &service{
		apiClient:       cfg.APIClient,
		store:           cfg.Store,
		downloadDir:     cfg.DownloadDir,
		enabledPref:     cfg.EnabledPref,
		enabledCategory: cfg.EnabledCategory,
		enabledPos:      cfg.EnabledPos,
		categoryInfoMap: cfg.CategoryInfoMap,
	}
}

type ScanResult struct {
	UpdatedFiles []*model.File // Files with changed last_modified on S3
}

type UpdateResult struct {
	UpdatedCount int // Number of files that were new or modified
}

// ScanAndCompare scans S3 and compares with existing catalog without updating DB.
func (s *service) ScanAndCompare(ctx context.Context, prefixes []string) (*ScanResult, error) {
	scanResult, err := s.scan(ctx, prefixes, false, false)
	if err != nil {
		return nil, err
	}
	return &ScanResult{UpdatedFiles: scanResult.updatedFiles}, nil
}

// ScanAndUpdate scans the API and updates the catalog. When force is set, every
// scanned file is flagged for re-download and re-import (see decideFileAction).
func (s *service) ScanAndUpdate(ctx context.Context, prefixes []string, force bool) (*UpdateResult, error) {
	scanResult, err := s.scan(ctx, prefixes, true, force)
	if err != nil {
		return nil, err
	}

	result := &UpdateResult{UpdatedCount: scanResult.updatedCount}

	// Skip pair sync if no updates (force flags both text/pos of every pair directly)
	if result.UpdatedCount == 0 {
		return result, nil
	}

	// Sync text/pos pairs: if either needs import, both should be imported together
	if err := s.store.SyncPairImportStatus(ctx); err != nil {
		return nil, fmt.Errorf("sync pair import status: %w", err)
	}

	return result, nil
}

type scanFilesResult struct {
	updatedFiles []*model.File
	updatedCount int
}

// scan is the unified scanning function used by both ScanAndCompare and ScanAndUpdate
func (s *service) scan(ctx context.Context, prefixes []string, updateDB, force bool) (*scanFilesResult, error) {
	// Read the download directory once; the set is shared across prefixes
	localFileSet, err := buildLocalFileSet(s.downloadDir)
	if err != nil {
		return nil, fmt.Errorf("build local file set: %w", err)
	}

	result := &scanFilesResult{}
	for _, prefix := range prefixes {
		files, err := s.apiClient.ListFilesByPrefix(ctx, prefix)
		if err != nil {
			return nil, fmt.Errorf("list files for prefix %q: %w", prefix, err)
		}

		category := s.extractCategoryFromPrefix(prefix)
		slog.Debug("scanning catalog files", "event", "catalog_scan", "category", category, "prefix", prefix, "file_count", len(files))

		scanResult, err := s.scanFiles(ctx, files, category, localFileSet, updateDB, force)
		if err != nil {
			return nil, fmt.Errorf("scan files: %w", err)
		}

		result.updatedFiles = append(result.updatedFiles, scanResult.updatedFiles...)
		result.updatedCount += scanResult.updatedCount
	}

	return result, nil
}

// scanFiles processes S3 files against existing catalog.
// If updateDB is true, upserts changed files to DB and returns count.
// If updateDB is false, only returns the list of changed files (dry-run mode).
func (s *service) scanFiles(ctx context.Context, files []api.FileInfo, category model.FileCategory, localFileSet map[string]struct{}, updateDB, force bool) (*scanFilesResult, error) {
	existingFiles, err := s.store.FilesByCategory(ctx, category)
	if err != nil {
		return nil, fmt.Errorf("get existing files: %w", err)
	}

	result := &scanFilesResult{}
	for _, file := range files {
		info := ParseFileInfo(file.Filename, category)
		if !s.isProcessable(info) {
			continue
		}

		existing := existingFiles[file.URL]
		_, localExists := localFileSet[file.Filename]
		action := decideFileAction(existing, file, localExists, updateDB, force)
		if action.skip {
			continue
		}

		record := newFileRecord(info, file, action.needsDownload, action.needsImport)

		// Dry-run only collects the candidate records; update mode persists them.
		if !updateDB {
			result.updatedFiles = append(result.updatedFiles, record)
			continue
		}

		if err := s.store.UpsertFile(ctx, record); err != nil {
			return nil, fmt.Errorf("upsert file %q: %w", file.URL, err)
		}
		if action.isNewOrModified {
			result.updatedCount++
		}
	}
	return result, nil
}

// fileAction is the download/import decision for a single scanned file, computed
// purely from the existing catalog record, the scanned file, local presence, and
// whether we are updating the DB (vs a dry-run). skip means the file is ignored.
type fileAction struct {
	skip            bool
	needsDownload   bool
	needsImport     bool
	isNewOrModified bool
}

// decideFileAction derives the catalog action for one file without any I/O.
// In the update path, force re-downloads and re-imports every scanned file (even
// unchanged ones already imported), so a config/filter change is re-applied without
// waiting for the DCAT feed to change. New/modified files are still handled via the
// existing==nil path, so force never causes added files to be missed.
func decideFileAction(existing *model.File, file api.FileInfo, localExists, updateDB, force bool) fileAction {
	isNewOrModified := existing == nil || !existing.LastModified.Equal(file.LastModified)

	// Dry-run compares only (force applies to the update path below).
	if !updateDB {
		if !isNewOrModified {
			return fileAction{skip: true}
		}
		return fileAction{needsDownload: !localExists, needsImport: true, isNewOrModified: true}
	}

	// Update: skip unchanged files unless a prior import is still pending or force is set.
	if !force && !isNewOrModified && (existing == nil || !existing.NeedsImport) {
		return fileAction{skip: true}
	}
	return fileAction{
		needsDownload:   force || !localExists || isNewOrModified,
		needsImport:     force || isNewOrModified || (existing != nil && existing.NeedsImport),
		isNewOrModified: isNewOrModified,
	}
}

// newFileRecord builds a catalog File record from parsed file info, the scanned
// S3 file, and the computed download/import flags.
func newFileRecord(info *model.File, file api.FileInfo, needsDownload, needsImport bool) *model.File {
	return &model.File{
		FileType:      info.FileType,
		FileCategory:  info.FileCategory,
		PrefCode:      info.PrefCode,
		FileKey:       info.FileKey,
		Filename:      file.Filename,
		LastModified:  file.LastModified,
		SourceURL:     file.URL,
		NeedsDownload: needsDownload,
		NeedsImport:   needsImport,
	}
}

// buildLocalFileSet reads the download directory once and returns a set of existing filenames
func buildLocalFileSet(downloadDir string) (map[string]struct{}, error) {
	entries, err := os.ReadDir(downloadDir)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return make(map[string]struct{}), nil
		}
		return nil, err
	}
	result := make(map[string]struct{}, len(entries))
	for _, e := range entries {
		if !e.IsDir() {
			result[e.Name()] = struct{}{}
		}
	}
	return result, nil
}

// isProcessable checks if the file should be processed based on filters
func (s *service) isProcessable(info *model.File) bool {
	// Category filter
	if len(s.enabledCategory) > 0 && !s.enabledCategory[info.FileCategory] {
		return false
	}

	// Prefecture filter (skip for "all" files with prefCode = 0)
	if len(s.enabledPref) > 0 && info.PrefCode != 0 && !slices.Contains(s.enabledPref, info.PrefCode) {
		return false
	}

	// Position data filter
	if !s.enabledPos && info.FileType == model.FileTypePos {
		return false
	}

	return true
}

// extractCategoryFromPrefix extracts category from S3 prefix using categoryInfoMap.
// Names are checked in sorted order so the result is deterministic.
func (s *service) extractCategoryFromPrefix(prefix string) model.FileCategory {
	for _, name := range slices.Sorted(maps.Keys(s.categoryInfoMap)) {
		info := s.categoryInfoMap[name]
		if strings.HasPrefix(prefix, info.S3TextPath) || strings.HasPrefix(prefix, info.S3PosPath) {
			return model.FileCategory(name)
		}
	}
	return model.FileCategory("")
}
