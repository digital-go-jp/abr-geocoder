package version

import (
	"runtime/debug"
	"strings"
	"testing"
)

func TestString(t *testing.T) {
	result := String()

	if !strings.Contains(result, "Version:") {
		t.Error("String() should contain 'Version:' label")
	}
	if !strings.Contains(result, "Commit:") {
		t.Error("String() should contain 'Commit:' label")
	}
	if !strings.Contains(result, Version) {
		t.Errorf("String() should contain Version value %q", Version)
	}
	if !strings.Contains(result, Commit) {
		t.Errorf("String() should contain Commit value %q", Commit)
	}
}

func TestDefaultValues(t *testing.T) {
	if Version == "" {
		t.Error("Version should not be empty")
	}
	if Commit == "" {
		t.Error("Commit should not be empty")
	}
}

func TestStringFormat(t *testing.T) {
	result := String()
	lines := strings.Split(result, "\n")

	if len(lines) != 2 {
		t.Errorf("String() should have 2 lines, got %d", len(lines))
	}
	if len(lines) > 0 && !strings.HasPrefix(lines[0], "Version:") {
		t.Errorf("First line should start with 'Version:', got %q", lines[0])
	}
	if len(lines) > 1 && !strings.HasPrefix(lines[1], "Commit:") {
		t.Errorf("Second line should start with 'Commit:', got %q", lines[1])
	}
}

func TestFromBuildInfo(t *testing.T) {
	stamped := func(mainVersion string, settings ...debug.BuildSetting) *debug.BuildInfo {
		return &debug.BuildInfo{Main: debug.Module{Version: mainVersion}, Settings: settings}
	}
	revision := debug.BuildSetting{Key: "vcs.revision", Value: "d011f1a0123456789abcdef0123456789abcdef0"}

	tests := []struct {
		name        string
		version     string
		commit      string
		info        *debug.BuildInfo
		wantVersion string
		wantCommit  string
	}{
		{name: "ldflags values win", version: "3.0.52", commit: "abc1234", info: stamped("v0.0.0-20260915000000-d011f1a01234", revision), wantVersion: "3.0.52", wantCommit: "abc1234"},
		{name: "go install uses the module version", version: "dev", commit: "none", info: stamped("v0.0.0-20260915000000-d011f1a01234"), wantVersion: "v0.0.0-20260915000000-d011f1a01234", wantCommit: "none"},
		{name: "local build uses the vcs revision", version: "dev", commit: "none", info: stamped("(devel)", revision), wantVersion: "dev", wantCommit: "d011f1a"},
		{name: "no build info keeps the defaults", version: "dev", commit: "none", info: stamped(""), wantVersion: "dev", wantCommit: "none"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotVersion, gotCommit := fromBuildInfo(tt.version, tt.commit, tt.info)
			if gotVersion != tt.wantVersion || gotCommit != tt.wantCommit {
				t.Errorf("fromBuildInfo() = %q, %q, want %q, %q", gotVersion, gotCommit, tt.wantVersion, tt.wantCommit)
			}
		})
	}
}
