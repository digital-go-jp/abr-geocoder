package command

import (
	"context"
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"abrdb/internal/infra/db"
	"abrdb/internal/schema"
)

// NewShowCmd creates a new show command
func NewShowCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "show",
		Short: "Display various information",
		Long:  "Display various information from the database.",
		Example: `
  # Show current configuration
  abrdb show config`,
	}

	cmd.AddCommand(newShowConfigCmd())

	return cmd
}

// newShowConfigCmd creates the show config subcommand
func newShowConfigCmd() *cobra.Command {
	return &cobra.Command{
		Use:                   "config",
		Short:                 "Display configuration settings",
		DisableFlagsInUseLine: true,
		Long:                  "Display configuration settings stored in the database.",
		Example: `
  # Show current configuration
  abrdb show config

  # To change configuration, re-run initialization
  abrdb init --force --pref 13 --category basic`,
		RunE: WithServices(func(ctx context.Context, sc *ServiceContainer) error {
			return runShowConfig(ctx, sc.QueryExecutor)
		}),
	}
}

// runShowConfig displays current configuration
func runShowConfig(ctx context.Context, executor *db.QueryExecutor) error {
	cfg, err := db.LoadABRDBConfig(ctx, executor)
	if err != nil {
		return fmt.Errorf("get config: %w", err)
	}

	if cfg == nil {
		fmt.Fprintf(os.Stderr, "\nNo configuration found\n")
		return nil
	}

	fmt.Fprintf(os.Stderr, "Configuration:\n")
	printIfSet("  enabled_pref: %s\n", cfg.EnabledPref)
	printIfSet("  enabled_category: %s\n", cfg.EnabledCategory)
	printIfSet("  enabled_pos: %s\n", cfg.EnabledPos)
	printIfSet("  abrdb_version: %s\n", cfg.Version)
	printIfSet("  import_config_profile: %s\n", cfg.ImportConfigProfile)

	if cfg.ImportConfigProfile != "" {
		// The database stores only the profile name; show the config this
		// binary resolves it to, since that is what `abrdb import` will use.
		data, err := schema.ProfileYAML(cfg.ImportConfigProfile)
		if err != nil {
			fmt.Fprintf(os.Stderr, "\nWarning: %v: run 'abrdb init' to reinitialize\n", err)
			return nil
		}
		fmt.Fprintf(os.Stderr, "\nImport config (embedded profile %q):\n%s", cfg.ImportConfigProfile, data)
	}

	return nil
}

// printIfSet prints a formatted string to stderr if value is non-empty
func printIfSet(format, value string) {
	if value != "" {
		fmt.Fprintf(os.Stderr, format, value)
	}
}
