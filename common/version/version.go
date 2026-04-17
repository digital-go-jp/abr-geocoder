// Package version provides build version information injected via ldflags.
package version

import "fmt"

// Build-time version information injected via ldflags:
//
//	go build -ldflags "-X abr.local/version.Version=x.y.z -X abr.local/version.Commit=abc123"
var (
	Version = "dev"  // Version is the semantic version (e.g., "1.2.3")
	Commit  = "none" // Commit is the git commit hash
)

// String returns formatted version information
func String() string {
	return fmt.Sprintf("Version: %s\nCommit: %s", Version, Commit)
}
