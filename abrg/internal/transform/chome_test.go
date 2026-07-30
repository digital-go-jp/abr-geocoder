package transform

import "testing"

func TestChomeToSymbol(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "standalone chome 1",
			input:    "1丁目",
			expected: "1@",
		},
		{
			name:     "standalone chome 9999",
			input:    "9999丁目",
			expected: "9999@",
		},
		{
			name:     "standalone chome -1",
			input:    "-1丁目",
			expected: "-1@",
		},
		{
			name:     "kanji chome - no change",
			input:    "一丁目",
			expected: "一丁目",
		},
		{
			name:     "non-arabic chome - no change",
			input:    "NOTアラビア数字丁目",
			expected: "NOTアラビア数字丁目",
		},
		{
			name:     "chome with ban - no change (should be handled by banchi)",
			input:    "1丁目2番",
			expected: "1@2番",
		},
		{
			name:     "no chome pattern",
			input:    "1-2-3",
			expected: "1-2-3",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, _ := ChomeToSymbol(tt.input)
			if result != tt.expected {
				t.Errorf("ChomeToSymbol(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func BenchmarkChomeToSymbol(b *testing.B) {
	testCases := []string{
		"1丁目",         // Standalone chome
		"1丁目2番",       // Chome with ban
		"漢字1丁目2番",     // Complex chome
		"NOTアラビア数字丁目", // Non-matching
		"1-2-3",       // No chome
	}

	for _, tc := range testCases {
		b.Run("input_"+tc, func(b *testing.B) {
			for b.Loop() {
				ChomeToSymbol(tc)
			}
		})
	}
}
