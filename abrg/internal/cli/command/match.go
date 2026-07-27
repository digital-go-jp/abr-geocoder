package command

import (
	"context"
	"time"

	"github.com/spf13/cobra"

	"abrg/internal/model"
	"abrg/internal/util"
)

// NewMatchCmd creates a new match command.
func NewMatchCmd() *cobra.Command {
	var opts processorOptions

	cmd := &cobra.Command{
		Use:   "match",
		Short: "Match addresses against ABR data",
		Long:  `Match addresses from an input file against the ABR dataset and write matching results to an output file.`,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return runMatch(cmd.Context(), opts)
		},
	}

	registerCommonFlags(cmd, &opts)
	return cmd
}

func runMatch(ctx context.Context, opts processorOptions) error {
	setup, err := setupProcessor(ctx, opts, "Matching", processorNeeds{Matcher: true})
	if err != nil {
		return err
	}
	defer setup.Cleanup()

	p := newDefaultProcessor(setup, func(ctx context.Context, address string) (*model.MatchResponse, error) {
		start := time.Now()
		result, err := setup.Matcher.Match(ctx, model.MatchQuery{
			Address:  address,
			Category: setup.Category,
			Limit:    opts.Limit,
			Pref:     setup.Pref,
		})
		if result != nil {
			result.ResultInfo.DurationMs = util.DurationMs(time.Since(start))
			setup.setResultInfo(&result.ResultInfo)
		}
		return result, err
	})
	return p.Run(ctx, setup.InFile, setup.OutFile)
}
