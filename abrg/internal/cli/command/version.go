package command

import (
	"fmt"

	"abr.local/common/version"
	"github.com/spf13/cobra"
)

// NewVersionCmd creates a new version command.
func NewVersionCmd() *cobra.Command {
	return &cobra.Command{
		Use:                   "version",
		Short:                 "Show version information",
		DisableFlagsInUseLine: true,
		RunE: func(_ *cobra.Command, _ []string) error {
			fmt.Println(version.String())
			return nil
		},
	}
}
