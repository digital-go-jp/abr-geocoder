package command

import (
	"bufio"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"runtime"
	"slices"

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
	DB       *sql.DB
	Repo     *repository.DB
	Matcher  matching.Matcher
	InFile   *os.File
	OutFile  *os.File
	Monitor  progress.Monitor
	CacheCfg *cache.Config
	// Category and Pref are the query parameters resolved against CacheCfg.
	Category model.Category
	Pref     string
	cleanup  []func()
}

// Cleanup releases all resources in reverse order.
func (s *processorSetup) Cleanup() {
	for _, fn := range slices.Backward(s.cleanup) {
		fn()
	}
}

// processorNeeds declares what setupProcessor must build and what the cache
// must provide for a command to run.
type processorNeeds struct {
	// Matcher requests a Matcher instance.
	Matcher bool
	// Pos requires the cache to hold position data.
	Pos bool
}

// setupProcessor initializes common components for processing commands.
func setupProcessor(ctx context.Context, opts processorOptions, taskName string, needs processorNeeds) (*processorSetup, error) {
	setup := &processorSetup{}

	dbCache, err := cache.NewDuckDBCache(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize cache: %w", err)
	}
	setup.cleanup = append(setup.cleanup, func() { _ = dbCache.Close() })
	setup.DB = dbCache.DB()
	setup.Repo = repository.NewRepository(setup.DB)

	cacheCfg, err := cache.LoadConfig(ctx, dbCache.DB())
	if err != nil {
		setup.Cleanup()
		return nil, fmt.Errorf("failed to load cache config: %w", err)
	}
	setup.CacheCfg = cacheCfg

	slog.Debug("cache configuration",
		"event", "cache_config",
		"pref", cacheCfg.EnabledPref,
		"category", cacheCfg.EnabledCategory)

	category, pref, err := validateOptions(opts, cacheCfg.EnabledCategory, cacheCfg.EnabledPref)
	if err != nil {
		setup.Cleanup()
		return nil, err
	}
	setup.Category = category
	setup.Pref = pref

	if needs.Pos && !cacheCfg.PosEnabled() {
		setup.Cleanup()
		return nil, errors.New("this command requires enable_pos=true in the database")
	}

	if needs.Matcher {
		setup.Matcher = matching.NewMatcher(setup.Repo, dbCache.Lookups(), cacheCfg.HasResidential(), cacheCfg.HasParcel())
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

	if monitor := progress.NewConsoleIfEnabled(opts.Quiet); monitor != nil {
		totalLines, err := countLines(opts.InputFile)
		if err != nil {
			setup.Cleanup()
			return nil, fmt.Errorf("failed to count input lines: %w", err)
		}
		monitor.StartTask(taskName, int64(totalLines))
		setup.Monitor = monitor
		setup.cleanup = append(setup.cleanup, func() { monitor.Cancel() })
	}

	return setup, nil
}

// setResultInfo sets common result info fields.
func (s *processorSetup) setResultInfo(info *model.ResultInfo) {
	info.SetMeta(version.Version, s.CacheCfg.DBVersion, s.CacheCfg.EnabledCategory, s.CacheCfg.EnabledPref)
}

// registerCommonFlags registers common flags for processing commands.
func registerCommonFlags(cmd *cobra.Command, opts *processorOptions) {
	cmd.Flags().StringVarP(&opts.InputFile, "input", "i", "", "Input file path (required)")
	cmd.Flags().StringVarP(&opts.OutputFile, "output", "o", "", "Output file path (required)")
	cmd.Flags().StringVarP(&opts.Category, "category", "c", "", "Category (all, basic, rsdtdsp, parcel)")
	cmd.Flags().StringVarP(&opts.Pref, "pref", "p", "", "Prefecture filter (prefecture code or 'all')")
	cmd.Flags().IntVarP(&opts.Limit, "limit", "l", validate.MinLimit,
		fmt.Sprintf("Maximum results per address (%d-%d)", validate.MinLimit, validate.MaxLimit))
	cmd.Flags().BoolVarP(&opts.Quiet, "quiet", "q", false, "Suppress progress output")
	_ = cmd.MarkFlagRequired("input")
	_ = cmd.MarkFlagRequired("output")
}

// validateOptions validates the category, pref and limit options against the
// cache configuration, returning the resolved category and pref. Both
// validate.ValidateCategory and validate.ValidatePref fall back to the
// enabled value when the corresponding flag is empty.
func validateOptions(opts processorOptions, enabledCategory, enabledPref string) (model.Category, string, error) {
	category, err := validate.ValidateCategory(opts.Category, enabledCategory)
	if err != nil {
		return "", "", err
	}

	pref, err := validate.ValidatePref(opts.Pref, enabledPref)
	if err != nil {
		return "", "", err
	}

	if err := validate.ValidateLimit(opts.Limit); err != nil {
		return "", "", err
	}

	return category, pref, nil
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
		if len(scanner.Bytes()) != 0 {
			count++
		}
	}
	return count, scanner.Err()
}
