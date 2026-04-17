package download

import (
	"context"
	"fmt"
	"log/slog"
	"path/filepath"

	"abr.local/common/progress"

	"abrdb/internal/infra/api"
	"abrdb/internal/infra/db"
	"abrdb/internal/infra/postgres"
	"abrdb/internal/model"
	"abrdb/internal/util"
)

type service struct {
	apiClient   *api.Client
	executor    *db.QueryExecutor
	progress    progress.Monitor
	downloadDir string
}

func New(
	apiClient *api.Client,
	executor *db.QueryExecutor,
	progress progress.Monitor,
	downloadDir string,
) *service {
	return &service{
		apiClient:   apiClient,
		executor:    executor,
		progress:    progress,
		downloadDir: downloadDir,
	}
}

func (s *service) DownloadPendingFiles(ctx context.Context) error {
	files, err := postgres.FilesToDownload(ctx, s.executor)
	if err != nil {
		return fmt.Errorf("get files to download: %w", err)
	}

	if len(files) == 0 {
		return nil
	}

	slog.Debug("starting file downloads", "event", "download_files", "file_count", len(files))

	return util.ExecuteConcurrently(ctx, files, func(ctx context.Context, file *model.File) error {
		destPath := filepath.Join(s.downloadDir, filepath.Base(file.Filename))

		if err := s.apiClient.DownloadFile(ctx, file.SourceURL, destPath); err != nil {
			return fmt.Errorf("download file %q: %w", file.SourceURL, err)
		}

		if err := postgres.MarkAsDownloaded(ctx, s.executor, file.Filename); err != nil {
			return fmt.Errorf("mark %q as downloaded: %w", file.Filename, err)
		}

		return nil
	}, s.progress, "Downloading files")
}
