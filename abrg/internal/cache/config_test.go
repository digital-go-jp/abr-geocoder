package cache

import (
	"testing"

	"abr.local/common/db"
)

func TestNewConfigCanonicalizesEnabledValues(t *testing.T) {
	tests := []struct {
		name         string
		pref         string
		category     string
		wantPref     string
		wantCategory string
	}{
		{"uppercase values stored verbatim by abrdb init", "ALL", "ALL", "all", "all"},
		{"padded mixed-case values", " 13 ", " Basic ", "13", "basic"},
		{"empty pref means all prefectures", "", "basic", "all", "basic"},
		{"canonical values pass through", "all", "rsdtdsp", "all", "rsdtdsp"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := newConfig(&db.ABRDBConfig{EnabledPref: tt.pref, EnabledCategory: tt.category})
			if cfg.EnabledPref != tt.wantPref {
				t.Errorf("EnabledPref = %q, want %q", cfg.EnabledPref, tt.wantPref)
			}
			if cfg.EnabledCategory != tt.wantCategory {
				t.Errorf("EnabledCategory = %q, want %q", cfg.EnabledCategory, tt.wantCategory)
			}
		})
	}
}

func TestConfigPosEnabled(t *testing.T) {
	tests := []struct {
		enabledPos string
		want       bool
	}{
		{"true", true},
		{"false", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run("enabled_pos "+tt.enabledPos, func(t *testing.T) {
			cfg := &Config{EnabledPos: tt.enabledPos}
			if got := cfg.PosEnabled(); got != tt.want {
				t.Errorf("PosEnabled() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestConfigDataAvailability(t *testing.T) {
	tests := []struct {
		enabledCategory string
		wantResidential bool
		wantParcel      bool
	}{
		{"all", true, true},
		{"rsdtdsp", true, false},
		{"parcel", false, true},
		{"basic", false, false},
		{"", false, false},
	}

	for _, tt := range tests {
		t.Run("category "+tt.enabledCategory, func(t *testing.T) {
			cfg := &Config{EnabledCategory: tt.enabledCategory}
			if got := cfg.HasResidential(); got != tt.wantResidential {
				t.Errorf("HasResidential() = %v, want %v", got, tt.wantResidential)
			}
			if got := cfg.HasParcel(); got != tt.wantParcel {
				t.Errorf("HasParcel() = %v, want %v", got, tt.wantParcel)
			}
		})
	}
}
