package normalize

import "testing"

func TestRemoveVS(t *testing.T) {
	tests := []struct {
		name         string
		input        string
		expected     string
		shouldChange bool
	}{
		{
			name:         "no variation selectors",
			input:        "愛媛県松山市",
			expected:     "愛媛県松山市",
			shouldChange: false,
		},
		{
			name:         "IVS U+E0103 after 媛 (Issue #236)",
			input:        "愛媛\U000E0103県松山市",
			expected:     "愛媛県松山市",
			shouldChange: true,
		},
		{
			name:         "SVS U+FE00",
			input:        "東京\uFE00都",
			expected:     "東京都",
			shouldChange: true,
		},
		{
			name:         "SVS U+FE0F (emoji variant selector)",
			input:        "渋谷区\uFE0F",
			expected:     "渋谷区",
			shouldChange: true,
		},
		{
			name:         "multiple IVS",
			input:        "愛\U000E0100媛\U000E0103県",
			expected:     "愛媛県",
			shouldChange: true,
		},
		{
			name:         "mixed SVS and IVS",
			input:        "東\uFE00京\U000E0100都",
			expected:     "東京都",
			shouldChange: true,
		},
		{
			name:         "empty string",
			input:        "",
			expected:     "",
			shouldChange: false,
		},
		{
			name:         "ASCII only",
			input:        "Tokyo",
			expected:     "Tokyo",
			shouldChange: false,
		},
		{
			name:         "full address with IVS (Issue #236 exact case)",
			input:        "愛媛\U000E0103県松山市三番町一丁目13番地",
			expected:     "愛媛県松山市三番町一丁目13番地",
			shouldChange: true,
		},
		{
			name:         "IVS upper bound U+E01EF removed",
			input:        "愛\U000E01EF媛",
			expected:     "愛媛",
			shouldChange: true,
		},
		{
			name:         "just past IVS U+E01F0 kept",
			input:        "愛\U000E01F0媛",
			expected:     "愛\U000E01F0媛",
			shouldChange: false,
		},
		{
			name:         "just past SVS U+FE10 kept",
			input:        "愛︐媛",
			expected:     "愛︐媛",
			shouldChange: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, changed := removeVS(tt.input)
			if result != tt.expected {
				t.Errorf("removeVS(%q) = %q, want %q", tt.input, result, tt.expected)
			}
			if changed != tt.shouldChange {
				t.Errorf("removeVS(%q) changed = %v, want %v", tt.input, changed, tt.shouldChange)
			}
		})
	}
}
