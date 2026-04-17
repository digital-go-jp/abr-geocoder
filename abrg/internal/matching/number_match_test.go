package matching

import (
	"testing"
)

func TestExtractFirstNumber(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "simple number",
			input:    "1-23-1",
			expected: "1",
		},
		{
			name:     "only number",
			input:    "123",
			expected: "123",
		},
		{
			name:     "number at start",
			input:    "4丁目",
			expected: "4",
		},
		{
			name:     "number with hyphen",
			input:    "1-2",
			expected: "1",
		},
		{
			name:     "empty string",
			input:    "",
			expected: "",
		},
		{
			name:     "no number",
			input:    "丁目",
			expected: "",
		},
		{
			name:     "text before number",
			input:    "虎ノ門1-23-1",
			expected: "1",
		},
		{
			name:     "kanji hundred",
			input:    "百番地",
			expected: "100",
		},
		{
			name:     "kanji two hundred",
			input:    "二百番地",
			expected: "200",
		},
		{
			name:     "kanji hundred twenty-three",
			input:    "百二十三号",
			expected: "123",
		},
		{
			name:     "kanji three hundred twenty-three",
			input:    "三百二十三号",
			expected: "323",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractFirstNumber(tt.input)
			if result != tt.expected {
				t.Errorf("extractFirstNumber(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}
