package schema

import (
	"slices"
	"strings"
	"testing"

	"abrdb/internal/model"
)

func TestProfileNames(t *testing.T) {
	want := []string{"default", "full"}
	if got := ProfileNames(); !slices.Equal(got, want) {
		t.Errorf("ProfileNames() = %v, want %v", got, want)
	}
}

// TestLoadProfile_EmbeddedProfiles guards the shipped configs: a broken
// embedded YAML would otherwise only surface at `abrdb init` time. Every
// profile must define all categories, since init generates the DDL for the
// whole config regardless of the enabled category.
func TestLoadProfile_EmbeddedProfiles(t *testing.T) {
	for _, name := range ProfileNames() {
		t.Run(name, func(t *testing.T) {
			cfg, err := LoadProfile(name)
			if err != nil {
				t.Fatalf("LoadProfile(%q) error = %v", name, err)
			}
			for _, cat := range model.AllCategory {
				if cfg.Category[string(cat)] == nil {
					t.Errorf("profile %q missing category %q", name, cat)
				}
			}
		})
	}
}

func TestLoadProfile_Unknown(t *testing.T) {
	_, err := LoadProfile("bogus")
	if err == nil {
		t.Fatal("LoadProfile(\"bogus\") = nil, want error")
	}
	for _, want := range []string{"bogus", "default", "full"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error %q does not mention %q", err, want)
		}
	}
}
