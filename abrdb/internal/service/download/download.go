package download

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"slices"

	"abr.local/common/progress"

	"abrdb/internal/infra/api"
	"abrdb/internal/model"
	"abrdb/internal/util"
)

// catalogStore tracks the download and pending-import state of catalog files.
type catalogStore interface {
	FilesToDownload(ctx context.Context) ([]*model.File, error)
	AllPendingImports(ctx context.Context) ([]*model.File, error)
	MarkAsDownloaded(ctx context.Context, filename string) error
}

type service struct {
	apiClient   *api.Client
	store       catalogStore
	progress    progress.Monitor
	downloadDir string
}

func New(
	apiClient *api.Client,
	store catalogStore,
	progress progress.Monitor,
	downloadDir string,
) *service {
	return &service{
		apiClient:   apiClient,
		store:       store,
		progress:    progress,
		downloadDir: downloadDir,
	}
}

// DownloadPendingFiles ensures that every file the import phase will need
// (needs_import=true) is present on disk by download time.
//
// Invariant: after this function returns nil, every file with needs_import=true
// in the catalog is available at downloadDir/<filename>.
//
// Two sources contribute to the download set:
//  1. Files explicitly flagged needs_download=true by the scan phase.
//  2. Files flagged needs_import=true whose local copy is missing.
//
// (2) closes the catalog/disk drift gap. The catalog tracks needs_download as a
// stage marker ("download phase should fetch"), not as a fact about the file
// system. On ephemeral storage (e.g., ECS Fargate /tmp) the disk state is reset
// per task while the catalog persists, so a needs_download=false flag set in a
// previous session does not guarantee the file is still on disk.
func (s *service) DownloadPendingFiles(ctx context.Context) error {
	queued, err := s.store.FilesToDownload(ctx)
	if err != nil {
		return fmt.Errorf("get files to download: %w", err)
	}

	missing, err := s.findMissingPendingImports(ctx, queued)
	if err != nil {
		return fmt.Errorf("find missing pending imports: %w", err)
	}

	files := slices.Concat(queued, missing)
	if len(files) == 0 {
		return nil
	}

	slog.Debug("starting file downloads",
		"event", "download_files",
		"file_count", len(files),
		"recovered_missing", len(missing),
	)

	return util.ExecuteConcurrently(ctx, files, func(ctx context.Context, file *model.File) error {
		destPath := filepath.Join(s.downloadDir, filepath.Base(file.Filename))

		if err := s.apiClient.DownloadFile(ctx, file.SourceURL, destPath); err != nil {
			return fmt.Errorf("download file %q: %w", file.SourceURL, err)
		}

		if err := s.store.MarkAsDownloaded(ctx, file.Filename); err != nil {
			return fmt.Errorf("mark %q as downloaded: %w", file.Filename, err)
		}

		return nil
	}, s.progress, "Downloading files")
}

// findMissingPendingImports returns files flagged needs_import=true that are
// not already in the queued set and are missing from downloadDir.
func (s *service) findMissingPendingImports(ctx context.Context, queued []*model.File) ([]*model.File, error) {
	pending, err := s.store.AllPendingImports(ctx)
	if err != nil {
		return nil, err
	}
	return filterMissingFiles(pending, queued, s.downloadDir), nil
}

// filterMissingFiles returns files from pending that are not in queued and not
// present on disk under downloadDir. A non-NotExist Stat error is treated as
// missing (and logged) so that permission-style errors do not silently skip a
// file that the import phase later requires.
func filterMissingFiles(pending, queued []*model.File, downloadDir string) []*model.File {
	inQueue := make(map[string]struct{}, len(queued))
	for _, f := range queued {
		inQueue[f.Filename] = struct{}{}
	}

	var missing []*model.File
	for _, f := range pending {
		if _, ok := inQueue[f.Filename]; ok {
			continue
		}
		path := filepath.Join(downloadDir, filepath.Base(f.Filename))
		_, err := os.Stat(path)
		if err == nil {
			continue
		}
		if !errors.Is(err, fs.ErrNotExist) {
			slog.Warn("stat failed for pending import; will re-download",
				"filename", f.Filename, "error", err)
		}
		missing = append(missing, f)
	}
	return missing
}
