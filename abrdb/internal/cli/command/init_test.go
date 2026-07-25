package command

import (
	"context"
	"errors"
	"os"
	"testing"
)

func TestNewInitCmd_EnvVars(t *testing.T) {
	tests := []struct {
		name     string
		envVars  map[string]string
		wantPref string
		wantCats string
		wantPos  bool
	}{
		{
			name:     "defaults when no env",
			envVars:  map[string]string{},
			wantPref: "all",
			wantCats: "basic",
			wantPos:  false,
		},
		{
			name: "reads ABRDB_PREF from env",
			envVars: map[string]string{
				"ABRDB_PREF": "13",
			},
			wantPref: "13",
			wantCats: "basic",
			wantPos:  false,
		},
		{
			name: "reads ABRDB_CATEGORY from env",
			envVars: map[string]string{
				"ABRDB_CATEGORY": "all",
			},
			wantPref: "all",
			wantCats: "all",
			wantPos:  false,
		},
		{
			name: "reads ABRDB_POS=true from env",
			envVars: map[string]string{
				"ABRDB_POS": "true",
			},
			wantPref: "all",
			wantCats: "basic",
			wantPos:  true,
		},
		{
			name: "reads all env vars",
			envVars: map[string]string{
				"ABRDB_PREF":     "13",
				"ABRDB_CATEGORY": "rsdtdsp",
				"ABRDB_POS":      "true",
			},
			wantPref: "13",
			wantCats: "rsdtdsp",
			wantPos:  true,
		},
		{
			name: "ABRDB_POS=false remains false",
			envVars: map[string]string{
				"ABRDB_POS": "false",
			},
			wantPref: "all",
			wantCats: "basic",
			wantPos:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Clear and set environment variables
			_ = os.Unsetenv("ABRDB_PREF")
			_ = os.Unsetenv("ABRDB_CATEGORY")
			_ = os.Unsetenv("ABRDB_POS")
			for k, v := range tt.envVars {
				_ = os.Setenv(k, v)
			}
			t.Cleanup(func() {
				_ = os.Unsetenv("ABRDB_PREF")
				_ = os.Unsetenv("ABRDB_CATEGORY")
				_ = os.Unsetenv("ABRDB_POS")
			})

			// Create command and check flag defaults
			cmd := NewInitCmd()

			pref, _ := cmd.Flags().GetString("pref")
			cats, _ := cmd.Flags().GetString("category")
			pos, _ := cmd.Flags().GetBool("pos")

			if pref != tt.wantPref {
				t.Errorf("pref = %q, want %q", pref, tt.wantPref)
			}
			if cats != tt.wantCats {
				t.Errorf("category = %q, want %q", cats, tt.wantCats)
			}
			if pos != tt.wantPos {
				t.Errorf("pos = %v, want %v", pos, tt.wantPos)
			}
		})
	}
}

// fakeMigrator records whether RunMigrations was invoked.
type fakeMigrator struct {
	called bool
	err    error
}

func (m *fakeMigrator) RunMigrations(context.Context) error {
	m.called = true
	return m.err
}

// TestRunInit_ValidatesBeforeMigrations pins that invalid inputs are rejected
// before the destructive migrations (DROP TABLE ... CASCADE) run.
func TestRunInit_ValidatesBeforeMigrations(t *testing.T) {
	tests := []struct {
		name string
		opts InitOptions
	}{
		{"invalid pref", InitOptions{Pref: "99", Category: "basic", Force: true}},
		{"non-numeric pref", InitOptions{Pref: "abc", Category: "basic", Force: true}},
		{"invalid category", InitOptions{Pref: "13", Category: "bogus", Force: true}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := &fakeMigrator{}
			err := runInit(t.Context(), nil, m, &tt.opts, "")
			if err == nil {
				t.Fatal("runInit() = nil, want validation error")
			}
			if m.called {
				t.Error("RunMigrations was called before input validation failed")
			}
		})
	}
}

// TestRunInit_MigrationErrorAfterValidation confirms valid inputs reach the
// migration step (and its error propagates before any DB access).
func TestRunInit_MigrationErrorAfterValidation(t *testing.T) {
	sentinel := errors.New("migration boom")
	m := &fakeMigrator{err: sentinel}
	err := runInit(t.Context(), nil, m, &InitOptions{Pref: "13", Category: "basic", Force: true}, "")
	if !errors.Is(err, sentinel) {
		t.Fatalf("runInit() = %v, want wrapped %v", err, sentinel)
	}
	if !m.called {
		t.Error("RunMigrations was not called for valid inputs")
	}
}
