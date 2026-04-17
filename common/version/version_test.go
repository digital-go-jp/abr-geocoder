package version

import (
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
