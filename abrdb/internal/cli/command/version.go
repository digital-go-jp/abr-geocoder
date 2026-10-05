package command

import (
	"fmt"

	"github.com/spf13/cobra"

	"github.com/digital-go-jp/abr-geocoder/common/version"
)

// NewVersionCmd creates a new version command
func NewVersionCmd() *cobra.Command {
	return &cobra.Command{
		Use:                   "version",
		Short:                 "Show version information",
		DisableFlagsInUseLine: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Println(version.String())
			return nil
		},
	}
}
