package util

import "testing"

func TestRemoveOazaAza(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
		changed  bool
	}{
		{
			name:     "no change needed",
			input:    "米花町1-2-3",
			expected: "米花町1-2-3",
			changed:  false,
		},
		{
			name:     "remove oaza prefix",
			input:    "大字米花町1-2-3",
			expected: "米花町1-2-3",
			changed:  true,
		},
		{
			name:     "remove aza prefix",
			input:    "字米花1-2-3",
			expected: "米花1-2-3",
			changed:  true,
		},
		{
			name:     "remove koaza prefix",
			input:    "小字米花1-2-3",
			expected: "米花1-2-3",
			changed:  true,
		},
		{
			name:     "empty string",
			input:    "",
			expected: "",
			changed:  false,
		},
		{
			name:     "oaza only",
			input:    "大字",
			expected: "",
			changed:  true,
		},
		{
			name:     "aza only - removed",
			input:    "字",
			expected: "",
			changed:  true,
		},
		{
			name:     "koaza only",
			input:    "小字",
			expected: "",
			changed:  true,
		},
		{
			name:     "aza in middle of string",
			input:    "米花町字米花",
			expected: "米花町米花",
			changed:  true,
		},
		{
			name:     "multiple oaza and aza",
			input:    "大字米花町字米花",
			expected: "米花町米花",
			changed:  true,
		},
		{
			name:     "koaza in middle of string",
			input:    "米花町小字米花",
			expected: "米花町米花",
			changed:  true,
		},
		{
			name:     "multiple oaza koaza and aza",
			input:    "大字大米花町小字中米花字米花",
			expected: "大米花町中米花米花",
			changed:  true,
		},
		{
			name:     "preserve koaza 1字 (一字)",
			input:    "金沢市田上本町1字",
			expected: "金沢市田上本町1字",
			changed:  false,
		},
		{
			name:     "preserve koaza 2字 (二字)",
			input:    "田上本町2字",
			expected: "田上本町2字",
			changed:  false,
		},
		{
			name:     "preserve koaza 10字 (十字)",
			input:    "田上本町10字",
			expected: "田上本町10字",
			changed:  false,
		},
		{
			name:     "remove 字 prefix but preserve digit+字",
			input:    "字田上本町1字",
			expected: "田上本町1字",
			changed:  true,
		},
		{
			name:     "remove 大字 prefix, preserve digit+字",
			input:    "大字後静村姉別原野1字",
			expected: "後静村姉別原野1字",
			changed:  true,
		},
		{
			name:     "preserve koaza 七字 (kanji numeral+字)",
			input:    "能登町字天坂乙七字",
			expected: "能登町天坂乙七字",
			changed:  true,
		},
		{
			name:     "preserve koaza 弐字 (formal kanji numeral+字)",
			input:    "能登町字天坂甲弐字",
			expected: "能登町天坂甲弐字",
			changed:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, changed := RemoveOazaAza(tt.input)
			if result != tt.expected {
				t.Errorf("RemoveOazaAza(%q) = %q, want %q", tt.input, result, tt.expected)
			}
			if changed != tt.changed {
				t.Errorf("RemoveOazaAza(%q) changed = %v, want %v", tt.input, changed, tt.changed)
			}
		})
	}
}

func BenchmarkRemoveOazaAza(b *testing.B) {
	testCases := []string{
		"米花町1-2-3",
		"大字米花町1-2-3",
		"字米花町1-2-3",
		"小字米花町1-2-3",
		"大字田中一丁目2番3号",
		"字田中一丁目2番3号",
		"小字田中一丁目2番3号",
		"田中字米花町",
		"大字田中字米花町",
		"大字田中小字中町字米花町",
	}

	for _, tc := range testCases {
		b.Run("input_"+tc, func(b *testing.B) {
			for b.Loop() {
				RemoveOazaAza(tc)
			}
		})
	}
}
