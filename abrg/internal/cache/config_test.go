package cache

import "testing"

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
