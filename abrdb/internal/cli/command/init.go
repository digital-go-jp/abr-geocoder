package command

import (
	"bufio"
	"context"
	"fmt"
	"log/slog"
	"os"
	"strings"

	"github.com/spf13/cobra"

	"abrdb/internal/infra/db"

	"abr.local/common/env"
	"abr.local/common/version"

	"abrdb/internal/config"
	"abrdb/internal/infra/postgres"
	"abrdb/internal/schema"
)

// InitOptions holds the init command options
type InitOptions struct {
	Pref      string
	Category  string
	EnablePos bool
	Force     bool   // Skip confirmation for existing data
	Profile   string // Embedded import config profile name
}

// NewInitCmd creates a new init command
func NewInitCmd() *cobra.Command {
	opts := &InitOptions{}

	cmd := &cobra.Command{
		Use:   "init",
		Short: "Initialize the database and configure data processing",
		Long:  "Initialize the database schema and choose prefecture and data category to process. Valid category: basic | rsdtdsp | parcel | all.",
		Example: `
  # Basic initialization (minimum required)
  abrdb init --pref 10

  # Initialize with a specific prefecture
  abrdb init --pref 13

  # Initialize for all prefectures
  abrdb init --pref all

  # Specify category (default: basic)
  abrdb init --pref 10 --category rsdtdsp

  # Include all data (--category all)
  abrdb init --pref 10 --category all

  # Enable position data
  abrdb init --pref 10 --pos

  # Import all ABR columns instead of the geocoder subset
  abrdb init --pref 10 --profile full`,
		RunE: WithServices(func(ctx context.Context, sc *ServiceContainer) error {
			importCfg, err := schema.LoadProfile(opts.Profile)
			if err != nil {
				return err
			}
			ddl := importCfg.GenerateDDL()

			migrator := postgres.NewMigrator(sc.QueryExecutor, ddl)
			return runInit(ctx, sc.QueryExecutor, migrator, opts)
		}),
	}

	// Flags with environment variable defaults (flag > env > default)
	cmd.Flags().StringVar(&opts.Pref, "pref",
		env.GetEnv("ABRDB_PREF", "all"),
		"Prefecture code to process ('all' for all prefectures or 1-47). Env: ABRDB_PREF")

	cmd.Flags().StringVar(&opts.Category, "category",
		env.GetEnv("ABRDB_CATEGORY", "basic"),
		"Data category group (basic, rsdtdsp, parcel, or all). Env: ABRDB_CATEGORY")

	cmd.Flags().BoolVar(&opts.EnablePos, "pos",
		env.GetEnv("ABRDB_POS", "false") == "true",
		"Enable position data processing. Env: ABRDB_POS")

	cmd.Flags().BoolVar(&opts.Force, "force", false, "Skip confirmation prompt for existing data")

	cmd.Flags().StringVar(&opts.Profile, "profile",
		env.GetEnv("ABRDB_PROFILE", schema.DefaultProfile),
		fmt.Sprintf("Embedded import config profile (%s). Env: ABRDB_PROFILE", strings.Join(schema.ProfileNames(), ", ")))

	return cmd
}

func runInit(ctx context.Context, executor *db.QueryExecutor, migrator interface{ RunMigrations(context.Context) error }, opts *InitOptions) error {
	// Validate inputs before running migrations: migrations drop and recreate
	// tables, so invalid input must not destroy existing data.
	if _, err := config.ParsePref(opts.Pref); err != nil {
		return fmt.Errorf("parse prefecture code: %w", err)
	}

	if _, err := config.ParseCategory(opts.Category); err != nil {
		return fmt.Errorf("parse category: %w", err)
	}

	if !opts.Force {
		hasData, err := config.CheckExistingData(ctx, executor)
		if err != nil {
			return fmt.Errorf("check existing data: %w", err)
		}

		if hasData {
			fmt.Fprintf(os.Stderr, "Warning: Existing data detected\n")
			fmt.Fprintf(os.Stderr, "This will reinitialize the database and may delete data\n")

			if !confirmAction("Continue? [y/N]: ") {
				fmt.Fprintf(os.Stderr, "Cancelled\n")
				return nil
			}
		}
	}

	// Run database migrations
	slog.Info("initializing database", "event", "db_init")
	if err := migrator.RunMigrations(ctx); err != nil {
		return fmt.Errorf("run migrations: %w", err)
	}

	// Save configuration to database - keep original inputs (group name and raw pref)
	if err := postgres.SaveInitConfig(ctx, executor, opts.Pref, opts.Category, opts.EnablePos, opts.Profile); err != nil {
		return fmt.Errorf("save config: %w", err)
	}

	// Save application version via helper
	if err := postgres.SaveVersion(ctx, executor, version.Version); err != nil {
		return fmt.Errorf("save application version: %w", err)
	}

	fmt.Fprintf(os.Stderr, "Configuration:\n")

	// Display prefecture code
	fmt.Fprintf(os.Stderr, "  Prefecture: %s\n", opts.Pref)

	// Display category
	fmt.Fprintf(os.Stderr, "  Category: %s\n", opts.Category)

	fmt.Fprintf(os.Stderr, "  Position: %s\n", onOff(opts.EnablePos))

	fmt.Fprintf(os.Stderr, "  Profile: %s\n", opts.Profile)

	return nil
}

// confirmAction prompts the user for confirmation
func confirmAction(prompt string) bool {
	reader := bufio.NewReader(os.Stdin)
	fmt.Fprint(os.Stderr, prompt)

	response, err := reader.ReadString('\n')
	if err != nil {
		return false
	}

	response = strings.TrimSpace(strings.ToLower(response))
	return response == "y" || response == "yes"
}

// onOff renders enabled/disabled strings
func onOff(b bool) string {
	if b {
		return "enabled"
	}
	return "disabled"
}
