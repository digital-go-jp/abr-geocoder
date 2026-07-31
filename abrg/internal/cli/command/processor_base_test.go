package command

import (
	"testing"

	"abrg/internal/model"
)

// TestValidateOptions pins that validateOptions delegates to
// validate.ValidateCategory/ValidatePref/ValidateLimit and returns their
// resolved values. The validation rules themselves are covered by the
// validate package's own tests.
func TestValidateOptions(t *testing.T) {
	tests := []struct {
		name            string
		opts            processorOptions
		enabledCategory string
		enabledPref     string
		wantCategory    model.Category
		wantPref        string
		wantErr         bool
	}{
		{
			name:            "omitted flags fall back to the cache config",
			opts:            processorOptions{Limit: 1},
			enabledCategory: "all",
			enabledPref:     "all",
			wantCategory:    model.CategoryAll,
			wantPref:        "all",
		},
		{
			name:            "omitted pref falls back to a single prefecture",
			opts:            processorOptions{Limit: 1},
			enabledCategory: "all",
			enabledPref:     "13",
			wantCategory:    model.CategoryAll,
			wantPref:        "13",
		},
		{
			name:            "explicit flags are kept",
			opts:            processorOptions{Category: "basic", Pref: "13", Limit: 1},
			enabledCategory: "all",
			enabledPref:     "all",
			wantCategory:    model.CategoryBasic,
			wantPref:        "13",
		},
		{
			name:            "pref all variant is normalized",
			opts:            processorOptions{Pref: "ALL", Limit: 1},
			enabledCategory: "all",
			enabledPref:     "all",
			wantCategory:    model.CategoryAll,
			wantPref:        "all",
		},
		{
			name:            "out-of-range limit is rejected",
			opts:            processorOptions{Limit: 0},
			enabledCategory: "all",
			enabledPref:     "all",
			wantErr:         true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			category, pref, err := validateOptions(tt.opts, tt.enabledCategory, tt.enabledPref)
			if (err != nil) != tt.wantErr {
				t.Fatalf("validateOptions() error = %v, wantErr %v", err, tt.wantErr)
			}
			if tt.wantErr {
				return
			}
			if category != tt.wantCategory {
				t.Errorf("category = %q, want %q", category, tt.wantCategory)
			}
			if pref != tt.wantPref {
				t.Errorf("pref = %q, want %q", pref, tt.wantPref)
			}
		})
	}
}
