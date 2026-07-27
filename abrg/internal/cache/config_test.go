package cache

import "testing"

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
