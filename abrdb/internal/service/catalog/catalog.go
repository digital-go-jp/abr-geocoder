package catalog

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"slices"
	"strings"

	"abrdb/internal/infra/api"
	"abrdb/internal/infra/postgres"
	"abrdb/internal/model"
	"abrdb/internal/schema"

	"abrdb/internal/infra/db"
)

type ServiceConfig struct {
	APIClient       *api.Client
	Executor        *db.QueryExecutor
	DownloadDir     string
	EnabledPref     []int
	EnabledCategory map[model.FileCategory]bool
	EnabledPos      bool
	CategoryInfoMap map[string]*schema.CategoryInfo
}

type service struct {
	apiClient       *api.Client
	executor        *db.QueryExecutor
	downloadDir     string
	enabledPref     []int
	enabledCategory map[model.FileCategory]bool
	enabledPos      bool
	categoryInfoMap map[string]*schema.CategoryInfo
}

func New(cfg ServiceConfig) *service {
	return &service{
		apiClient:       cfg.APIClient,
		executor:        cfg.Executor,
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
	scanResult, err := s.scan(ctx, prefixes, false)
	if err != nil {
		return nil, err
	}
	return &ScanResult{UpdatedFiles: scanResult.updatedFiles}, nil
}

// ScanAndUpdate scans the API and updates the catalog.
func (s *service) ScanAndUpdate(ctx context.Context, prefixes []string) (*UpdateResult, error) {
	scanResult, err := s.scan(ctx, prefixes, true)
	if err != nil {
		return nil, err
	}

	result := &UpdateResult{UpdatedCount: scanResult.updatedCount}

	// Skip pair sync if no updates
	if result.UpdatedCount == 0 {
		return result, nil
	}

	// Sync text/pos pairs: if either needs import, both should be imported together
	if err := postgres.SyncPairImportStatus(ctx, s.executor); err != nil {
		return nil, fmt.Errorf("sync pair import status: %w", err)
	}

	return result, nil
}

type scanFilesResult struct {
	updatedFiles []*model.File
	updatedCount int
}

// scan is the unified scanning function used by both ScanAndCompare and ScanAndUpdate
func (s *service) scan(ctx context.Context, prefixes []string, updateDB bool) (*scanFilesResult, error) {
	// Build shared scan context once
	sc, err := s.newScanContext()
	if err != nil {
		return nil, err
	}

	result := &scanFilesResult{}
	for _, prefix := range prefixes {
		files, err := s.apiClient.ListFilesByPrefix(ctx, prefix)
		if err != nil {
			return nil, fmt.Errorf("list files for prefix %q: %w", prefix, err)
		}

		category := s.extractCategoryFromPrefix(prefix)
		slog.Debug("scanning catalog files", "event", "catalog_scan", "category", category, "prefix", prefix, "file_count", len(files))

		scanResult, err := s.scanFiles(ctx, files, category, sc, updateDB)
		if err != nil {
			return nil, fmt.Errorf("scan files: %w", err)
		}

		result.updatedFiles = append(result.updatedFiles, scanResult.updatedFiles...)
		result.updatedCount += scanResult.updatedCount
	}

	return result, nil
}

type scanContext struct {
	localFileSet map[string]struct{}
}

func (s *service) newScanContext() (*scanContext, error) {
	localFileSet, err := buildLocalFileSet(s.downloadDir)
	if err != nil {
		return nil, fmt.Errorf("build local file set: %w", err)
	}
	return &scanContext{localFileSet: localFileSet}, nil
}

type fileContext struct {
	existingFiles map[string]*model.File
	localFileSet  map[string]struct{}
}

func (s *service) prepareFileContext(ctx context.Context, category model.FileCategory, sc *scanContext) (*fileContext, error) {
	existingFiles, err := postgres.FilesByCategory(ctx, s.executor, category)
	if err != nil {
		return nil, fmt.Errorf("get existing files: %w", err)
	}
	return &fileContext{existingFiles: existingFiles, localFileSet: sc.localFileSet}, nil
}

// scanFiles processes S3 files against existing catalog.
// If updateDB is true, upserts changed files to DB and returns count.
// If updateDB is false, only returns the list of changed files (dry-run mode).
func (s *service) scanFiles(ctx context.Context, files []api.FileInfo, category model.FileCategory, sc *scanContext, updateDB bool) (*scanFilesResult, error) {
	fc, err := s.prepareFileContext(ctx, category, sc)
	if err != nil {
		return nil, err
	}

	result := &scanFilesResult{}
	for _, file := range files {
		info := ParseFileInfo(file.Filename, category)
		if !s.isProcessable(info) {
			continue
		}

		existing := fc.existingFiles[file.URL]
		_, localExists := fc.localFileSet[file.Filename]
		action := decideFileAction(existing, file, localExists, updateDB)
		if action.skip {
			continue
		}

		record := newFileRecord(info, file, action.needsDownload, action.needsImport)

		// Dry-run only collects the candidate records; update mode persists them.
		if !updateDB {
			result.updatedFiles = append(result.updatedFiles, record)
			continue
		}

		if err := postgres.UpsertFile(ctx, s.executor, record); err != nil {
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
func decideFileAction(existing *model.File, file api.FileInfo, localExists, updateDB bool) fileAction {
	isNewOrModified := existing == nil || !existing.LastModified.Equal(file.LastModified)

	// Dry-run: only new/modified files are candidates; they always need import.
	if !updateDB {
		if !isNewOrModified {
			return fileAction{skip: true}
		}
		return fileAction{needsDownload: !localExists, needsImport: true, isNewOrModified: true}
	}

	// Update: skip unchanged files unless a prior import is still pending.
	if !isNewOrModified && (existing == nil || !existing.NeedsImport) {
		return fileAction{skip: true}
	}
	return fileAction{
		needsDownload:   !localExists || isNewOrModified,
		needsImport:     isNewOrModified || (existing != nil && existing.NeedsImport),
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

// extractCategoryFromPrefix extracts category from S3 prefix using categoryInfoMap
func (s *service) extractCategoryFromPrefix(prefix string) model.FileCategory {
	for name, info := range s.categoryInfoMap {
		if strings.HasPrefix(prefix, info.S3TextPath) || strings.HasPrefix(prefix, info.S3PosPath) {
			return model.FileCategory(name)
		}
	}
	return model.FileCategory("")
}
