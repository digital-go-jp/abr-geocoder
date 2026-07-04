// abrdb is a CLI tool for importing ABR (Address Base Registry) data into PostgreSQL.
package main

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/joho/godotenv"
	"github.com/spf13/cobra"

	"abr.local/common/logging"

	"abrdb/internal/cli/command"
)

func main() {
	os.Exit(run())
}

func run() int {
	_ = godotenv.Load()

	slog.SetDefault(logging.NewFromEnv())

	// Set up signal handling for all commands
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	rootCmd := &cobra.Command{
		Use:   "abrdb",
		Short: "ABR Database Tools",
		Long: `ABR Database Tools is a CLI application for managing
Japanese address data from the Address Base Registry (ABR).`,
	}

	// Clean error UX: don't dump usage on runtime errors
	rootCmd.SilenceUsage = true
	rootCmd.SilenceErrors = true

	// Add commands - each command handles its own initialization
	rootCmd.AddCommand(
		command.NewInitCmd(),
		command.NewImportCmd(),
		command.NewShowCmd(),
		command.NewVersionCmd(),
	)

	err := rootCmd.ExecuteContext(ctx)
	if err == nil {
		return 0
	}
	// Exit code 2 for dry-run with pending changes (not an error)
	if _, ok := errors.AsType[command.ExitCode2Error](err); ok {
		return 2
	}
	// Print only the error (usage suppressed) and exit non-zero
	_, _ = os.Stderr.WriteString(err.Error() + "\n")
	return 1
}
