package command

import (
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
