package command

import (
	"bufio"
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"os"
	"runtime"

	"github.com/spf13/cobra"

	"abr.local/common/progress"
	"abr.local/common/version"

	"abrg/internal/cache"
	"abrg/internal/matching"
	"abrg/internal/model"
	"abrg/internal/repository"
	"abrg/internal/validate"
)

// defaultBufferSize is the buffer size for parallel processing channels.
const defaultBufferSize = 1000

// processorOptions holds common options for processing commands.
type processorOptions struct {
	InputFile  string
	OutputFile string
	Category   string
	Pref       string
	Limit      int
	Quiet      bool
}

// processorSetup holds initialized components for processing commands.
type processorSetup struct {
	DB              *sql.DB
	Matcher         matching.Matcher
	InFile          *os.File
	OutFile         *os.File
	Monitor         progress.Monitor
	DBVersion       string
	EnabledCategory string
	EnabledPref     string
	cleanup         []func()
}

// Cleanup releases all resources in reverse order.
func (s *processorSetup) Cleanup() {
	for i := len(s.cleanup) - 1; i >= 0; i-- {
		s.cleanup[i]()
	}
}

// setupProcessor initializes common components for processing commands.
// If initMatcher is true, the Matcher field is initialized.
func setupProcessor(ctx context.Context, opts processorOptions, taskName string, initMatcher bool) (*processorSetup, error) {
	setup := &processorSetup{}

	dbCache, err := cache.NewDuckDBCache(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize cache: %w", err)
	}
	setup.cleanup = append(setup.cleanup, func() { _ = dbCache.Close() })
	setup.DB = dbCache.DB()

	cacheCfg, err := cache.LoadConfig(ctx, dbCache.DB())
	if err != nil {
		setup.Cleanup()
		return nil, fmt.Errorf("failed to load cache config: %w", err)
	}
	setup.DBVersion = cacheCfg.DBVersion
	setup.EnabledCategory = cacheCfg.EnabledCategory
	setup.EnabledPref = cacheCfg.EnabledPref

	slog.Debug("cache configuration",
		"event", "cache_config",
		"pref", setup.EnabledPref,
		"category", setup.EnabledCategory)

	if err := validateOptions(opts, setup.EnabledCategory, setup.EnabledPref); err != nil {
		setup.Cleanup()
		return nil, err
	}

	if initMatcher {
		setup.Matcher = matching.NewMatcher(repository.NewRepository(dbCache.DB()), dbCache.Lookups())
	}

	inFile, err := os.Open(opts.InputFile)
	if err != nil {
		setup.Cleanup()
		return nil, fmt.Errorf("failed to open input file: %w", err)
	}
	setup.InFile = inFile
	setup.cleanup = append(setup.cleanup, func() { _ = inFile.Close() })

	outFile, err := os.Create(opts.OutputFile)
	if err != nil {
		setup.Cleanup()
		return nil, fmt.Errorf("failed to create output file: %w", err)
	}
	setup.OutFile = outFile
	setup.cleanup = append(setup.cleanup, func() { _ = outFile.Close() })

	if progress.ShouldShowProgress(opts.Quiet) {
		totalLines, err := countLines(opts.InputFile)
		if err != nil {
			setup.Cleanup()
			return nil, fmt.Errorf("failed to count input lines: %w", err)
		}
		console := progress.NewConsole()
		console.StartTask(taskName, int64(totalLines))
		setup.Monitor = console
		setup.cleanup = append(setup.cleanup, func() { console.Cancel() })
	}

	return setup, nil
}

func (s *processorSetup) resolveCategory(category string) string {
	if category == "" {
		return s.EnabledCategory
	}
	return category
}

// setResultInfo sets common result info fields.
func (s *processorSetup) setResultInfo(info *model.ResultInfo) {
	info.APIVersion = version.Version
	info.DBVersion = s.DBVersion
	info.EnabledCategory = s.EnabledCategory
	info.EnabledPref = s.EnabledPref
}

// registerCommonFlags registers common flags for processing commands.
func registerCommonFlags(cmd *cobra.Command, opts *processorOptions) {
	cmd.Flags().StringVarP(&opts.InputFile, "input", "i", "", "Input file path (required)")
	cmd.Flags().StringVarP(&opts.OutputFile, "output", "o", "", "Output file path (required)")
	cmd.Flags().StringVarP(&opts.Category, "category", "c", "", "Category (all, basic, rsdtdsp, parcel)")
	cmd.Flags().StringVarP(&opts.Pref, "pref", "p", "", "Prefecture filter (prefecture code or 'all')")
	cmd.Flags().IntVarP(&opts.Limit, "limit", "l", 1, "Maximum results per address (1-5)")
	cmd.Flags().BoolVarP(&opts.Quiet, "quiet", "q", false, "Suppress progress output")
	_ = cmd.MarkFlagRequired("input")
	_ = cmd.MarkFlagRequired("output")
}

// validateOptions validates category and pref options against the cache configuration.
func validateOptions(opts processorOptions, enabledCategory, enabledPref string) error {
	if opts.Category != "" {
		if _, err := validate.ValidateCategory(opts.Category, enabledCategory); err != nil {
			return err
		}
	}
	if opts.Pref != "" {
		if _, err := validate.ValidatePref(opts.Pref, enabledPref); err != nil {
			return err
		}
	}
	return nil
}

// newDefaultProcessor creates a ParallelProcessor with standard settings.
func newDefaultProcessor[R any](setup *processorSetup, process processFunc[R]) *parallelProcessor[R] {
	return &parallelProcessor[R]{
		Process:    process,
		Workers:    runtime.GOMAXPROCS(0),
		BufferSize: defaultBufferSize,
		Monitor:    setup.Monitor,
	}
}

func countLines(filename string) (int, error) {
	file, err := os.Open(filename)
	if err != nil {
		return 0, err
	}
	defer func() { _ = file.Close() }()

	scanner := bufio.NewScanner(file)
	count := 0
	for scanner.Scan() {
		if scanner.Text() != "" {
			count++
		}
	}
	return count, scanner.Err()
}
