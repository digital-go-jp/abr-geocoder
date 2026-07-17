package command

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"os"
	"slices"
	"time"

	"github.com/spf13/cobra"

	"abrdb/internal/infra/db"

	"abr.local/common/progress"

	"abrdb/internal/infra/duckdb"
	"abrdb/internal/infra/postgres"
	"abrdb/internal/model"
	"abrdb/internal/schema"
	"abrdb/internal/service/catalog"
	"abrdb/internal/service/download"
	"abrdb/internal/service/importer"
	"abrdb/internal/util"
)

// ExitCode2Error signals that the command should exit with code 2 (changes pending).
type ExitCode2Error struct{ Message string }

func (e ExitCode2Error) Error() string { return e.Message }

// ImportOptions holds the import command options.
type ImportOptions struct {
	DryRun  bool
	Force   bool
	Verbose bool
	Quiet   bool
}

// NewImportCmd creates a new import command.
func NewImportCmd() *cobra.Command {
	opts := &ImportOptions{}

	cmd := &cobra.Command{
		Use:   "import",
		Short: "Import address data",
		Long: `Download and import address data from the ABR data source to the database.

By default, checks for changes first and only imports if updates are detected.
Use --force to skip change detection and import immediately.`,
		Example: `
	# See what would be imported
	abrdb import --dry-run

	# Import only if changes detected (default behavior)
	abrdb import

	# Force import without change detection
	abrdb import --force`,
		RunE: WithServices(func(ctx context.Context, sc *ServiceContainer) error {
			cfg := sc.Config

			// Load all import configuration from database (single query)
			importConfig, err := util.LoadImportConfig(ctx, sc.QueryExecutor)
			if err != nil {
				return fmt.Errorf("load config from database: %w", err)
			}
			switch {
			case importConfig.ImportConfigYAML == "":
				return errors.New("import config not found in database: run 'abrdb init' first")
			case len(importConfig.EnabledPref) == 0:
				return errors.New("enabled_pref not configured: run 'abrdb init' first")
			case len(importConfig.EnabledCategory) == 0:
				return errors.New("enabled_category not configured: run 'abrdb init' first")
			}

			importCfg, err := schema.ParseImportConfig([]byte(importConfig.ImportConfigYAML))
			if err != nil {
				return fmt.Errorf("parse import config: %w", err)
			}
			categoryInfoMap := importCfg.ToCategoryInfoMap()

			s3Prefixes, err := buildS3Prefixes(importConfig, categoryInfoMap)
			if err != nil {
				return fmt.Errorf("build S3 prefixes: %w", err)
			}

			categoryMap := make(map[model.FileCategory]bool, len(importConfig.EnabledCategory))
			for _, cat := range importConfig.EnabledCategory {
				categoryMap[cat] = true
			}

			// Ensure download directory exists
			if err := os.MkdirAll(cfg.Process.DownloadDir, 0o755); err != nil {
				return fmt.Errorf("create download dir %q: %w", cfg.Process.DownloadDir, err)
			}

			catalogService := catalog.New(catalog.ServiceConfig{
				APIClient:       sc.APIClient,
				Executor:        sc.QueryExecutor,
				DownloadDir:     cfg.Process.DownloadDir,
				EnabledPref:     importConfig.EnabledPref,
				EnabledCategory: categoryMap,
				EnabledPos:      importConfig.EnabledPos,
				CategoryInfoMap: categoryInfoMap,
			})

			// Dry-run: only catalog comparison, skip DuckDB/importer initialization
			if opts.DryRun {
				return runImportDryRun(ctx, sc.QueryExecutor, catalogService, s3Prefixes, opts)
			}

			// Force mode: skip change detection and re-import every in-scope file
			if opts.Force {
				services, err := initImportServices(sc, categoryInfoMap, opts.Quiet)
				if err != nil {
					return err
				}
				defer func() { _ = services.etl.Close() }()

				return executeImportPipeline(ctx, catalogService, services.download, services.importer, s3Prefixes, importConfig.EnabledCategory, false, true)
			}

			// Default: check for changes first, import only if updates exist
			return runImportWithChangeDetection(ctx, sc, catalogService, s3Prefixes, importConfig.EnabledCategory, categoryInfoMap, opts)
		}),
	}

	cmd.Flags().BoolVarP(&opts.DryRun, "dry-run", "d", false, "Show what would be imported without making changes")
	cmd.Flags().BoolVarP(&opts.Force, "force", "f", false, "Force import without change detection")
	cmd.Flags().BoolVarP(&opts.Verbose, "verbose", "v", false, "Show detailed file list (with --dry-run)")
	cmd.Flags().BoolVarP(&opts.Quiet, "quiet", "q", false, "Suppress progress output")
	cmd.MarkFlagsMutuallyExclusive("dry-run", "force")

	return cmd
}

type catalogAPI interface {
	ScanAndCompare(ctx context.Context, prefixes []string) (*catalog.ScanResult, error)
	ScanAndUpdate(ctx context.Context, prefixes []string, force bool) (*catalog.UpdateResult, error)
}

type downloadAPI interface {
	DownloadPendingFiles(ctx context.Context) error
}

type importerAPI interface {
	ImportCategoryBatch(ctx context.Context, category []model.FileCategory) (map[string]float64, error)
}

// importServices holds initialized services for import operations
type importServices struct {
	etl      *duckdb.ETL
	download downloadAPI
	importer importerAPI
}

// initImportServices initializes DuckDB ETL, download, and import services
// pgCatalogStore adapts the postgres catalog functions to importer.catalogStore.
type pgCatalogStore struct{ executor *db.QueryExecutor }

func (s pgCatalogStore) PendingImportsByCategory(ctx context.Context, categories []model.FileCategory) (map[model.FileCategory][]*model.File, error) {
	return postgres.PendingImportsByCategory(ctx, s.executor, categories)
}

func (s pgCatalogStore) MarkAsImported(ctx context.Context, filenames ...string) error {
	return postgres.MarkAsImported(ctx, s.executor, filenames...)
}

func initImportServices(sc *ServiceContainer, categoryInfoMap map[string]*schema.CategoryInfo, quiet bool) (*importServices, error) {
	cfg := sc.Config

	etl, err := duckdb.New(duckdb.ETLConfig{
		DB: cfg.Database,
	})
	if err != nil {
		return nil, fmt.Errorf("create DuckDB ETL: %w", err)
	}

	progressMonitor := progress.NewConsoleIfEnabled(quiet)

	downloadService := download.New(
		sc.APIClient,
		sc.QueryExecutor,
		progressMonitor,
		cfg.Process.DownloadDir,
	)

	importService := importer.New(
		etl,
		pgCatalogStore{sc.QueryExecutor},
		progressMonitor,
		cfg.Process.DownloadDir,
		categoryInfoMap,
	)

	return &importServices{
		etl:      etl,
		download: downloadService,
		importer: importService,
	}, nil
}

// runImportDryRun handles the dry-run mode: compare catalog only, no downloads or imports
func runImportDryRun(
	ctx context.Context,
	executor *db.QueryExecutor,
	catalogService catalogAPI,
	s3Prefixes []string,
	opts *ImportOptions,
) error {
	slog.Info("starting import dry-run", "event", "import")

	result, err := catalogService.ScanAndCompare(ctx, s3Prefixes)
	if err != nil {
		return fmt.Errorf("scan and compare catalog: %w", err)
	}
	return printDryRunSummary(ctx, executor, result, opts.Verbose)
}

// runImportWithChangeDetection handles the default mode: check for changes first, import only if updates exist.
// Designed for automated workflows (e.g., AWS Step Functions).
// Returns exit code 0 for both "no changes" and "import completed successfully".
func runImportWithChangeDetection(
	ctx context.Context,
	sc *ServiceContainer,
	catalogService catalogAPI,
	s3Prefixes []string,
	enabledCategory []model.FileCategory,
	categoryInfoMap map[string]*schema.CategoryInfo,
	opts *ImportOptions,
) error {
	slog.Info("checking for updates", "event", "import")

	scanResult, err := catalogService.ScanAndCompare(ctx, s3Prefixes)
	if err != nil {
		return fmt.Errorf("scan and compare catalog: %w", err)
	}

	pendingSummary, err := postgres.GetPendingSummary(ctx, sc.QueryExecutor)
	if err != nil {
		return fmt.Errorf("get pending summary: %w", err)
	}

	// Determine if there's anything to do
	hasS3Changes := len(scanResult.UpdatedFiles) > 0
	hasPendingWork := len(pendingSummary) > 0

	if !hasS3Changes && !hasPendingWork {
		slog.Info("no changes detected", "event", "import")
		fmt.Println("No changes detected.")
		return nil
	}

	// Log what we're doing
	if hasPendingWork && !hasS3Changes {
		slog.Info("resuming pending imports",
			"event", "import",
			"category_pending", len(pendingSummary),
		)
	} else {
		slog.Info("changes detected, starting import",
			"event", "import",
			"updated_files", len(scanResult.UpdatedFiles),
		)
	}

	services, err := initImportServices(sc, categoryInfoMap, opts.Quiet)
	if err != nil {
		return err
	}
	defer func() { _ = services.etl.Close() }()

	return executeImportPipeline(ctx, catalogService, services.download, services.importer, s3Prefixes, enabledCategory, hasPendingWork, false)
}

// executeImportPipeline runs the full import pipeline: scan → download → import.
// hasPendingWork indicates whether there are existing pending imports in the database,
// which affects the early-return behavior when no new S3 changes are detected.
// force re-imports every in-scope file regardless of change detection.
func executeImportPipeline(
	ctx context.Context,
	catalogService catalogAPI,
	downloadService downloadAPI,
	importService importerAPI,
	s3Prefixes []string,
	enabledCategory []model.FileCategory,
	hasPendingWork bool,
	force bool,
) error {
	totalStart := time.Now()
	slog.Info("starting import", "event", "import")

	// 1. Scan and update catalog
	updateResult, err := catalogService.ScanAndUpdate(ctx, s3Prefixes, force)
	if err != nil {
		return fmt.Errorf("scan and update catalog: %w", err)
	}

	// Early return if no changes and no pending work (force always re-imports)
	if !force && updateResult.UpdatedCount == 0 && !hasPendingWork {
		fmt.Println("No changes detected.")
		return nil
	}

	// 2. Download pending files
	downloadStart := time.Now()
	if err := downloadService.DownloadPendingFiles(ctx); err != nil {
		return fmt.Errorf("download pending files: %w", err)
	}
	downloadSec := time.Since(downloadStart).Seconds()

	// 3. Import downloaded data (single query for pending files, per-category timing)
	categoryTimings, err := importService.ImportCategoryBatch(ctx, enabledCategory)
	if err != nil {
		return fmt.Errorf("import data: %w", err)
	}

	totalSec := time.Since(totalStart).Seconds()
	slog.Debug("import timing",
		"event", "import_timing",
		"total_sec", totalSec,
		"download_sec", downloadSec,
		"category_sec", categoryTimings,
	)
	fmt.Println("Import completed.")
	return nil
}

func printDryRunSummary(ctx context.Context, executor *db.QueryExecutor, scanResult *catalog.ScanResult, verbose bool) error {
	pendingSummary, err := postgres.GetPendingSummary(ctx, executor)
	if err != nil {
		return fmt.Errorf("get pending summary: %w", err)
	}

	pendingImports := make(map[model.FileCategory]int)
	for _, s := range pendingSummary {
		pendingImports[s.Category] = s.ImportCount
	}

	// Group updated files by category
	updatedByCategory := make(map[model.FileCategory][]*model.File)
	for _, f := range scanResult.UpdatedFiles {
		updatedByCategory[f.FileCategory] = append(updatedByCategory[f.FileCategory], f)
	}

	// Collect all category (from both sources)
	category := collectCategory(pendingImports, updatedByCategory)
	if len(category) == 0 {
		fmt.Println("No changes detected.")
		return nil
	}

	fmt.Println("Pending changes:")
	var totalDownload, totalImport int

	for _, cat := range category {
		updated := updatedByCategory[cat]
		downloadCount := len(updated)
		importCount := max(downloadCount, pendingImports[cat])

		if downloadCount == 0 && importCount == 0 {
			continue
		}

		fmt.Printf("  %s: %d files to download, %d pairs to import\n", cat, downloadCount, importCount)
		totalDownload += downloadCount
		totalImport += importCount

		if verbose {
			for _, f := range updated {
				fmt.Printf("    - %s (updated)\n", f.Filename)
			}
		}
	}

	fmt.Printf("Total: %d files to download, %d pairs to import\n", totalDownload, totalImport)
	if totalDownload > 0 || totalImport > 0 {
		return ExitCode2Error{Message: "changes pending"}
	}
	return nil
}

// collectCategory returns a sorted list of unique category values from both maps
func collectCategory(pending map[model.FileCategory]int, updated map[model.FileCategory][]*model.File) []model.FileCategory {
	allCategory := make(map[model.FileCategory]struct{}, len(pending)+len(updated))
	for cat := range pending {
		allCategory[cat] = struct{}{}
	}
	for cat := range updated {
		allCategory[cat] = struct{}{}
	}
	return slices.Sorted(maps.Keys(allCategory))
}

// buildS3Prefixes generates S3 prefixes for all enabled category
func buildS3Prefixes(importConfig *util.ImportConfig, categoryInfoMap map[string]*schema.CategoryInfo) ([]string, error) {
	maxPrefixes := len(importConfig.EnabledCategory)
	if importConfig.EnabledPos {
		maxPrefixes *= 2
	}
	s3Prefixes := make([]string, 0, maxPrefixes)

	for _, category := range importConfig.EnabledCategory {
		info := categoryInfoMap[string(category)]
		if info == nil {
			return nil, fmt.Errorf("category %q not found in config map", category)
		}
		s3Prefixes = append(s3Prefixes, info.S3TextPath)
		if importConfig.EnabledPos {
			s3Prefixes = append(s3Prefixes, info.S3PosPath)
		}
	}
	return s3Prefixes, nil
}
