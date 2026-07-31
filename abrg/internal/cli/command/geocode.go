package command

import (
	"context"

	"github.com/spf13/cobra"

	"abrg/internal/matching"
	"abrg/internal/model"
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
	setup, err := setupProcessor(ctx, opts, "Geocoding", processorNeeds{Matcher: true, Pos: true})
	if err != nil {
		return err
	}
	defer setup.Cleanup()

	p := newDefaultProcessor(setup, func(ctx context.Context, address string) (*model.GeocodeResponse, error) {
		return runTimed(setup, func() (*model.GeocodeResponse, error) {
			return matching.Geocode(ctx, setup.Matcher, setup.Repo, model.MatchQuery{
				Address:  address,
				Category: setup.Category,
				Limit:    opts.Limit,
				Pref:     setup.Pref,
			})
		})
	})
	return p.Run(ctx, setup.InFile, setup.OutFile)
}
