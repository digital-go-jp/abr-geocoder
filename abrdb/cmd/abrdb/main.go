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

	return finish(rootCmd.ExecuteContext(ctx))
}

// finish maps the command result to the process exit code, printing the
// error to stderr only for failures (usage output is suppressed).
func finish(err error) int {
	code := exitCode(err)
	if code == exitFailure {
		_, _ = os.Stderr.WriteString(err.Error() + "\n")
	}
	return code
}

// Exit codes follow diff(1): 0 = no changes / success, 1 = dry-run found
// pending changes, 2 = failure. Failures use 2 rather than 1 so that an
// unhandled failure - including a panic, which the runtime also exits 2 on -
// can never be read as a dry-run result.
const (
	exitSuccess        = 0
	exitChangesPending = 1
	exitFailure        = 2
)

// exitCode maps the error returned by command execution to the process exit code.
func exitCode(err error) int {
	if err == nil {
		return exitSuccess
	}
	// A dry-run reporting pending changes is a result, not an error
	if _, ok := errors.AsType[command.ChangesPendingError](err); ok {
		return exitChangesPending
	}
	return exitFailure
}
