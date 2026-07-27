package command

import (
	"context"
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"abrg/internal/cache"
	"abrg/internal/infra/config"
	"abrg/internal/infra/duckdb"
)

// resolveCachePath resolves the cache path from flag or config.
// Returns error if path is empty.
func resolveCachePath(flagValue string) (string, error) {
	cfg := config.Load()
	path := duckdb.ResolvePath(flagValue, cfg.Cache.Path)
	if path == "" {
		return "", fmt.Errorf("cache file path required: use -c/--cache flag or set %s environment variable", duckdb.EnvCachePath)
	}
	return path, nil
}

func printCacheInfo(info *cache.Info) {
	fmt.Printf("Cache file: %s\n", info.Path)
	fmt.Printf("File size: %.2f MB\n", info.SizeMB())
	fmt.Printf("Build time: %s\n", info.BuildTime)
	fmt.Printf("Schema version: %s\n", info.SchemaVersion)
	if info.Warning != "" {
		fmt.Printf("Warning: %s\n", info.Warning)
	}
	fmt.Println("Table records:")

	for _, table := range duckdb.AllTables {
		count, ok := info.Tables[table]
		if !ok {
			continue
		}
		if count < 0 {
			fmt.Printf("  %s: (not available)\n", table)
		} else {
			fmt.Printf("  %s: %d\n", table, count)
		}
	}
}

// NewCacheCmd creates a new cache command with subcommands.
func NewCacheCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "cache",
		Short: "Manage DuckDB cache",
		Long:  `Commands for building and inspecting the DuckDB cache used for address normalization.`,
	}

	cmd.AddCommand(
		newCacheBuildCmd(),
		newCacheInfoCmd(),
	)

	return cmd
}

func newCacheBuildCmd() *cobra.Command {
	var cachePath string

	cmd := &cobra.Command{
		Use:   "build",
		Short: "Build DuckDB cache from PostgreSQL",
		Long: `Build a DuckDB cache file from PostgreSQL data.
The data category is automatically determined from the PostgreSQL database configuration.`,
		RunE: func(cmd *cobra.Command, _ []string) error {
			path, err := resolveCachePath(cachePath)
			if err != nil {
				return err
			}
			return runCacheBuild(cmd.Context(), path)
		},
	}

	cmd.Flags().StringVarP(&cachePath, "cache", "c", "", "Cache file path (default: ~/.abrg/cache/abrg.duckdb)")

	return cmd
}

func newCacheInfoCmd() *cobra.Command {
	var cachePath string

	cmd := &cobra.Command{
		Use:   "info",
		Short: "Show cache file information",
		Long: `Display information about a DuckDB cache file including table counts and metadata.
This command does not require PostgreSQL connection.`,
		RunE: func(cmd *cobra.Command, _ []string) error {
			path, err := resolveCachePath(cachePath)
			if err != nil {
				return err
			}
			return runCacheInfo(cmd.Context(), path)
		},
	}

	cmd.Flags().StringVarP(&cachePath, "cache", "c", "", "Cache file path (default: ~/.abrg/cache/abrg.duckdb)")

	return cmd
}

func runCacheBuild(ctx context.Context, cachePath string) error {
	// Build to temporary file first to ensure atomicity
	tmpPath := cachePath + ".tmp"

	if err := cache.Build(ctx, tmpPath); err != nil {
		// Clean up temp file on failure
		_ = os.Remove(tmpPath)
		return fmt.Errorf("failed to build cache: %w", err)
	}

	// Atomic replacement: only remove old cache after new one is successfully built
	if err := os.Rename(tmpPath, cachePath); err != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("failed to replace cache file: %w", err)
	}

	info, err := cache.LoadInfo(ctx, cachePath)
	if err != nil {
		return fmt.Errorf("load cache info: %w", err)
	}
	printCacheInfo(info)

	return nil
}

func runCacheInfo(ctx context.Context, cachePath string) error {
	info, err := cache.LoadInfo(ctx, cachePath)
	if err != nil {
		return fmt.Errorf("load cache info: %w", err)
	}
	printCacheInfo(info)
	return nil
}
