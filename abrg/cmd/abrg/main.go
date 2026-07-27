// abrg is a geocoder API server providing geocoding, reverse geocoding, and address normalization.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/spf13/cobra"

	"abr.local/common/logging"

	"abrg/internal/cli/command"
)

func main() {
	slog.SetDefault(logging.NewFromEnv())

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	rootCmd := &cobra.Command{
		Use:   "abrg",
		Short: "ABR Geocoder Server",
		Long: `ABR Geocoder Server is a geocoding service that provides
address normalization, geocoding, and reverse geocoding APIs
for Japanese addresses using the Address Base Registry (ABR).`,
	}

	rootCmd.AddCommand(
		command.NewServerCmd(),
		command.NewVersionCmd(),
		command.NewMatchCmd(),
		command.NewGeocodeCmd(),
		command.NewReverseCmd(),
		command.NewCacheCmd(),
	)

	if err := rootCmd.ExecuteContext(ctx); err != nil {
		os.Exit(1)
	}
}
