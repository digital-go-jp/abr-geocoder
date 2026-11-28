package matching

import "testing"

func TestInPref(t *testing.T) {
	tests := []struct {
		lgCode, pref string
		want         bool
	}{
		{"131016", "13", true},
		{"131016", "14", false},
		{"011002", "1", true},
		{"011002", "01", true},
		{"131016", "all", true},
		{"131016", "", true},
		{"", "13", false},
	}
	for _, tt := range tests {
		if got := inPref(tt.lgCode, tt.pref); got != tt.want {
			t.Errorf("inPref(%q, %q) = %v, want %v", tt.lgCode, tt.pref, got, tt.want)
		}
	}
}
