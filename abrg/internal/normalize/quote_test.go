package normalize

import "testing"

func TestRemoveQuotes(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
		changed  bool
	}{
		{
			name:     "no quotes",
			input:    "東京都新宿区1-2-3",
			expected: "東京都新宿区1-2-3",
			changed:  false,
		},
		{
			name:     "double quotes",
			input:    "\"東京都新宿区1-2-3\"",
			expected: "東京都新宿区1-2-3",
			changed:  true,
		},
		{
			name:     "single quotes",
			input:    "'東京都新宿区1-2-3'",
			expected: "東京都新宿区1-2-3",
			changed:  true,
		},
		{
			name:     "only opening double quote",
			input:    "\"東京都新宿区1-2-3",
			expected: "\"東京都新宿区1-2-3",
			changed:  false,
		},
		{
			name:     "only closing double quote",
			input:    "東京都新宿区1-2-3\"",
			expected: "東京都新宿区1-2-3\"",
			changed:  false,
		},
		{
			name:     "only opening single quote",
			input:    "'東京都新宿区1-2-3",
			expected: "'東京都新宿区1-2-3",
			changed:  false,
		},
		{
			name:     "only closing single quote",
			input:    "東京都新宿区1-2-3'",
			expected: "東京都新宿区1-2-3'",
			changed:  false,
		},
		{
			name:     "empty string",
			input:    "",
			expected: "",
			changed:  false,
		},
		{
			name:     "single character",
			input:    "a",
			expected: "a",
			changed:  false,
		},
		{
			name:     "just double quotes",
			input:    "\"\"",
			expected: "",
			changed:  true,
		},
		{
			name:     "just single quotes",
			input:    "''",
			expected: "",
			changed:  true,
		},
		{
			name:     "nested quotes - double outside single inside",
			input:    "\"'東京都新宿区'\"",
			expected: "東京都新宿区",
			changed:  true,
		},
		{
			name:     "mismatched quotes",
			input:    "\"東京都新宿区'",
			expected: "\"東京都新宿区'",
			changed:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, changed := removeQuotes(tt.input)
			if result != tt.expected {
				t.Errorf("removeQuotes(%q) = %q, want %q", tt.input, result, tt.expected)
			}
			if changed != tt.changed {
				t.Errorf("removeQuotes(%q) changed = %v, want %v", tt.input, changed, tt.changed)
			}
		})
	}
}
