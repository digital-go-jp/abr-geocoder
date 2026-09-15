package command

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/spf13/cobra"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
	"github.com/digital-go-jp/abr-geocoder/abrg/internal/normalize"
	"github.com/digital-go-jp/abr-geocoder/abrg/internal/reverse"
	"github.com/digital-go-jp/abr-geocoder/abrg/internal/util"
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
	setup, err := setupProcessor(ctx, opts, "Reverse geocoding", processorNeeds{Pos: true})
	if err != nil {
		return err
	}
	defer setup.Cleanup()

	// Data availability follows the cache build configuration.
	// The category tables themselves are checked for when the cache is opened.
	reverser := reverse.NewReverseGeocoder(setup.Repo, setup.CacheCfg.HasResidential(), setup.CacheCfg.HasParcel())
	p := newDefaultProcessor(setup, func(ctx context.Context, line string) (*model.ReverseResponse, error) {
		lon, lat, err := parseCoordinates(line)
		if err != nil {
			return nil, err
		}

		return runTimed(setup, func() (*model.ReverseResponse, error) {
			return reverser.Reverse(ctx, model.ReverseQuery{
				Lon:      lon,
				Lat:      lat,
				Category: setup.Category,
				Pref:     setup.Pref,
				Limit:    opts.Limit,
			})
		})
	})
	return p.Run(ctx, setup.InFile, setup.OutFile)
}

// parseCoordinates parses a "lon,lat" string into float64 values, ignoring invisible characters such as a BOM.
func parseCoordinates(line string) (lon, lat float64, err error) {
	cleaned, _ := normalize.RemoveDefaultIgnorable(line)
	lonStr, latStr, found := strings.Cut(strings.TrimSpace(cleaned), ",")
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
