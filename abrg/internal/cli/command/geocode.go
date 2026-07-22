package command

import (
	"context"
	"time"

	"github.com/spf13/cobra"

	"abrg/internal/matching"
	"abrg/internal/model"
	"abrg/internal/util"
)

// NewGeocodeCmd creates a new geocode command.
func NewGeocodeCmd() *cobra.Command {
	var opts processorOptions

	cmd := &cobra.Command{
		Use:   "geocode",
		Short: "Geocode addresses from stdin or file",
		Long:  `Geocode addresses from an input file and write GeoJSON results to an output file.`,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return runGeocode(cmd.Context(), opts)
		},
	}

	registerCommonFlags(cmd, &opts)
	return cmd
}

func runGeocode(ctx context.Context, opts processorOptions) error {
	setup, err := setupProcessor(ctx, opts, "Geocoding", true)
	if err != nil {
		return err
	}
	defer setup.Cleanup()

	categoryVal := model.Category(setup.resolveCategory(opts.Category))

	p := newDefaultProcessor(setup, func(ctx context.Context, address string) (*model.GeocodeResponse, error) {
		start := time.Now()
		result, err := matching.Geocode(ctx, setup.Matcher, setup.Repo, model.MatchQuery{
			Address:  address,
			Category: categoryVal,
			Limit:    opts.Limit,
			Pref:     opts.Pref,
		})
		if result != nil {
			result.ResultInfo.DurationMs = util.DurationMs(time.Since(start))
			setup.setResultInfo(&result.ResultInfo)
		}
		return result, err
	})
	return p.Run(ctx, setup.InFile, setup.OutFile)
}
