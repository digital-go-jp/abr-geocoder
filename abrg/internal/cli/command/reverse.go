package command

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"abrg/internal/infra/duckdb"
	"abrg/internal/model"
	"abrg/internal/reverse"
	"abrg/internal/util"
)

// NewReverseCmd creates a new reverse geocoding command.
func NewReverseCmd() *cobra.Command {
	var opts processorOptions

	cmd := &cobra.Command{
		Use:   "reverse",
		Short: "Reverse geocode coordinates from file",
		Long: `Reverse geocode coordinates from an input file and write GeoJSON results to an output file.

Input file format: one coordinate pair per line as "lon,lat"
Example:
  139.7369,35.6812
  135.5023,34.6937`,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return runReverse(cmd.Context(), opts)
		},
	}

	registerCommonFlags(cmd, &opts)
	return cmd
}

func runReverse(ctx context.Context, opts processorOptions) error {
	setup, err := setupProcessor(ctx, opts, "Reverse geocoding", false)
	if err != nil {
		return err
	}
	defer setup.Cleanup()

	reverser := reverse.NewReverseGeocoder(setup.Repo,
		reverse.TableExists(context.Background(), setup.DB, duckdb.TableRsdtdsp),
		reverse.TableExists(context.Background(), setup.DB, duckdb.TableParcel),
	)
	categoryVal := model.Category(setup.resolveCategory(opts.Category))

	p := newDefaultProcessor(setup, func(ctx context.Context, line string) (*model.ReverseResponse, error) {
		lon, lat, err := parseCoordinates(line)
		if err != nil {
			return nil, err
		}

		start := time.Now()
		result, err := reverser.Reverse(ctx, model.ReverseQuery{
			Lon:      lon,
			Lat:      lat,
			Category: categoryVal,
			Pref:     opts.Pref,
			Limit:    opts.Limit,
		})
		if result != nil {
			result.ResultInfo.DurationMs = util.DurationMs(time.Since(start))
			setup.setResultInfo(&result.ResultInfo)
		}
		return result, err
	})
	return p.Run(ctx, setup.InFile, setup.OutFile)
}

// parseCoordinates parses a "lon,lat" string into float64 values.
func parseCoordinates(line string) (lon, lat float64, err error) {
	lonStr, latStr, found := strings.Cut(strings.TrimSpace(line), ",")
	if !found {
		return 0, 0, fmt.Errorf("expected 'lon,lat' format, got %q", line)
	}

	if lon, err = strconv.ParseFloat(strings.TrimSpace(lonStr), 64); err != nil {
		return 0, 0, fmt.Errorf("invalid longitude: %w", err)
	}

	if lat, err = strconv.ParseFloat(strings.TrimSpace(latStr), 64); err != nil {
		return 0, 0, fmt.Errorf("invalid latitude: %w", err)
	}

	if err = util.ValidateCoordinates(lon, lat); err != nil {
		return 0, 0, err
	}

	return lon, lat, nil
}
