package validate

import (
	"strings"
	"testing"

	"abrg/internal/model"
)

func TestValidateCategory(t *testing.T) {
	tests := []struct {
		name            string
		categoryStr     string
		enabledCategory string
		wantCategory    model.Category
		wantErr         bool
	}{
		{
			name:            "empty category defaults to enabledCategory (all)",
			categoryStr:     "",
			enabledCategory: "all",
			wantCategory:    model.CategoryAll,
		},
		{
			name:            "empty category defaults to enabledCategory (basic)",
			categoryStr:     "",
			enabledCategory: "basic",
			wantCategory:    model.CategoryBasic,
		},
		{
			name:            "basic category with all enabled",
			categoryStr:     "basic",
			enabledCategory: "all",
			wantCategory:    model.CategoryBasic,
		},
		{
			name:            "all category with all enabled",
			categoryStr:     "all",
			enabledCategory: "all",
			wantCategory:    model.CategoryAll,
		},
		{
			name:            "all category with basic enabled - error",
			categoryStr:     "all",
			enabledCategory: "basic",
			wantCategory:    model.CategoryAll,
			wantErr:         true,
		},
		{
			name:            "rsdtdsp category with all enabled",
			categoryStr:     "rsdtdsp",
			enabledCategory: "all",
			wantCategory:    model.CategoryResidential,
		},
		{
			name:            "rsdtdsp category with rsdtdsp enabled",
			categoryStr:     "rsdtdsp",
			enabledCategory: "rsdtdsp",
			wantCategory:    model.CategoryResidential,
		},
		{
			name:            "rsdtdsp category with basic enabled - error",
			categoryStr:     "rsdtdsp",
			enabledCategory: "basic",
			wantCategory:    model.CategoryResidential,
			wantErr:         true,
		},
		{
			name:            "parcel category with all enabled",
			categoryStr:     "parcel",
			enabledCategory: "all",
			wantCategory:    model.CategoryParcel,
		},
		{
			name:            "parcel category with parcel enabled",
			categoryStr:     "parcel",
			enabledCategory: "parcel",
			wantCategory:    model.CategoryParcel,
		},
		{
			name:            "parcel category with basic enabled - error",
			categoryStr:     "parcel",
			enabledCategory: "basic",
			wantCategory:    model.CategoryParcel,
			wantErr:         true,
		},
		{
			name:            "invalid category",
			categoryStr:     "invalid",
			enabledCategory: "all",
			wantCategory:    model.Category("invalid"),
			wantErr:         true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ValidateCategory(tt.categoryStr, tt.enabledCategory)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateCategory() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.wantCategory {
				t.Errorf("ValidateCategory() = %v, want %v", got, tt.wantCategory)
			}
		})
	}
}

func TestValidatePref(t *testing.T) {
	tests := []struct {
		name        string
		prefStr     string
		enabledPref string
		wantPref    string
		wantErr     bool
	}{
		{
			name:        "empty pref defaults to enabledPref (all)",
			prefStr:     "",
			enabledPref: "all",
			wantPref:    "all",
		},
		{
			name:        "empty pref defaults to enabledPref (13)",
			prefStr:     "",
			enabledPref: "13",
			wantPref:    "13",
		},
		{
			name:        "all pref with all enabled",
			prefStr:     "all",
			enabledPref: "all",
			wantPref:    "all",
		},
		{
			name:        "uppercase ALL normalizes to all",
			prefStr:     "ALL",
			enabledPref: "all",
			wantPref:    "all",
		},
		{
			name:        "padded and mixed case all normalizes to all",
			prefStr:     " All ",
			enabledPref: "all",
			wantPref:    "all",
		},
		{
			name:        "specific pref with all enabled",
			prefStr:     "13",
			enabledPref: "all",
			wantPref:    "13",
		},
		{
			name:        "matching specific pref",
			prefStr:     "13",
			enabledPref: "13",
			wantPref:    "13",
		},
		{
			name:        "non-matching specific pref - error",
			prefStr:     "14",
			enabledPref: "13",
			wantErr:     true,
		},
		{
			name:        "invalid pref code 0 - error",
			prefStr:     "0",
			enabledPref: "all",
			wantErr:     true,
		},
		{
			name:        "invalid pref code 48 - error",
			prefStr:     "48",
			enabledPref: "all",
			wantErr:     true,
		},
		{
			name:        "valid min pref code 1",
			prefStr:     "1",
			enabledPref: "all",
			wantPref:    "1",
		},
		{
			name:        "valid max pref code 47",
			prefStr:     "47",
			enabledPref: "all",
			wantPref:    "47",
		},
		{
			name:        "non-numeric pref - error",
			prefStr:     "abc",
			enabledPref: "all",
			wantErr:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ValidatePref(tt.prefStr, tt.enabledPref)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidatePref() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.wantPref {
				t.Errorf("ValidatePref() = %v, want %v", got, tt.wantPref)
			}
		})
	}
}

func TestCategoryCompatible(t *testing.T) {
	tests := []struct {
		name            string
		category        string
		enabledCategory string
		wantErr         bool
		wantErrContains string
	}{
		// all category
		{"all with all enabled", "all", "all", false, ""},
		{"all with basic enabled", "all", "basic", true, "requires enabled_category to be 'all'"},
		{"all with rsdtdsp enabled", "all", "rsdtdsp", true, "requires enabled_category to be 'all'"},
		{"all with parcel enabled", "all", "parcel", true, "requires enabled_category to be 'all'"},
		// basic category
		{"basic with all enabled", "basic", "all", false, ""},
		{"basic with basic enabled", "basic", "basic", false, ""},
		{"basic with rsdtdsp enabled", "basic", "rsdtdsp", false, ""},
		{"basic with parcel enabled", "basic", "parcel", false, ""},
		// rsdtdsp category
		{"rsdtdsp with all enabled", "rsdtdsp", "all", false, ""},
		{"rsdtdsp with rsdtdsp enabled", "rsdtdsp", "rsdtdsp", false, ""},
		{"rsdtdsp with basic enabled", "rsdtdsp", "basic", true, "requires enabled_category to be 'all' or 'rsdtdsp'"},
		{"rsdtdsp with parcel enabled", "rsdtdsp", "parcel", true, "requires enabled_category to be 'all' or 'rsdtdsp'"},
		// parcel category
		{"parcel with all enabled", "parcel", "all", false, ""},
		{"parcel with parcel enabled", "parcel", "parcel", false, ""},
		{"parcel with basic enabled", "parcel", "basic", true, "requires enabled_category to be 'all' or 'parcel'"},
		{"parcel with rsdtdsp enabled", "parcel", "rsdtdsp", true, "requires enabled_category to be 'all' or 'parcel'"},
		// invalid
		{"invalid category", "invalid", "all", true, "invalid category"},
		{"empty category", "", "all", true, "invalid category"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := categoryCompatible(tt.category, tt.enabledCategory)
			if (err != nil) != tt.wantErr {
				t.Errorf("categoryCompatible(%q, %q) error = %v, wantErr %v", tt.category, tt.enabledCategory, err, tt.wantErr)
			}
			if tt.wantErr && err != nil && tt.wantErrContains != "" {
				if !strings.Contains(err.Error(), tt.wantErrContains) {
					t.Errorf("categoryCompatible(%q, %q) error = %q, want containing %q",
						tt.category, tt.enabledCategory, err.Error(), tt.wantErrContains)
				}
			}
		})
	}
}

func TestValidateLimit(t *testing.T) {
	tests := []struct {
		name    string
		limit   int
		wantErr bool
	}{
		{"negative is rejected", -1, true},
		{"zero is rejected", 0, true},
		{"lower bound is accepted", 1, false},
		{"upper bound is accepted", 5, false},
		{"above upper bound is rejected", 6, true},
		{"far above upper bound is rejected", 1000, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateLimit(tt.limit)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateLimit(%d) error = %v, wantErr %v", tt.limit, err, tt.wantErr)
			}
		})
	}
}
