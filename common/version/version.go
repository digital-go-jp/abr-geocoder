// Package version provides build version information.
package version

import (
	"fmt"
	"runtime/debug"
)

// Version and Commit are injected via ldflags:
//
//	go build -ldflags "-X github.com/digital-go-jp/abr-geocoder/common/version.Version=x.y.z -X github.com/digital-go-jp/abr-geocoder/common/version.Commit=abc123"
//
// A build without them, such as go install, takes them from the build
// information Go records in the binary.
var (
	Version = "dev"  // Version is the semantic version (e.g., "1.2.3")
	Commit  = "none" // Commit is the git commit hash
)

func init() {
	if info, ok := debug.ReadBuildInfo(); ok {
		Version, Commit = fromBuildInfo(Version, Commit, info)
	}
}

// fromBuildInfo fills the defaults left by a build without ldflags from the
// main module version and the VCS revision.
func fromBuildInfo(version, commit string, info *debug.BuildInfo) (string, string) {
	if version == "dev" && info.Main.Version != "" && info.Main.Version != "(devel)" {
		version = info.Main.Version
	}
	if commit == "none" {
		for _, s := range info.Settings {
			if s.Key == "vcs.revision" && len(s.Value) >= 7 {
				commit = s.Value[:7]
			}
		}
	}
	return version, commit
}

// String returns formatted version information
func String() string {
	return fmt.Sprintf("Version: %s\nCommit: %s", Version, Commit)
}
