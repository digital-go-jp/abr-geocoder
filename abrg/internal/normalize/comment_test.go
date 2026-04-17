package normalize

import "testing"

func TestRemoveComments(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
		changed  bool
	}{
		{
			name:     "no comments",
			input:    "東京都新宿区1-2-3",
			expected: "東京都新宿区1-2-3",
			changed:  false,
		},
		{
			name:     "block comment",
			input:    "東京都/* comment */新宿区1-2-3",
			expected: "東京都新宿区1-2-3",
			changed:  true,
		},
		{
			name:     "line comment",
			input:    "東京都新宿区1-2-3 // some comment",
			expected: "東京都新宿区1-2-3",
			changed:  true,
		},
		{
			name:     "multiple block comments",
			input:    "東京都/* comment1 */新宿区/* comment2 */1-2-3",
			expected: "東京都新宿区1-2-3",
			changed:  true,
		},
		{
			name:     "block comment only",
			input:    "/* comment */",
			expected: "",
			changed:  true,
		},
		{
			name:     "line comment only",
			input:    "// some comment",
			expected: "",
			changed:  true,
		},
		{
			name:     "empty string",
			input:    "",
			expected: "",
			changed:  false,
		},
		{
			name:     "multiline block comment",
			input:    "東京都/* \ncomment\ncomment */新宿区",
			expected: "東京都新宿区",
			changed:  true,
		},
		{
			name:     "nested-like patterns",
			input:    "東京都/* outer /* inner */ */新宿区",
			expected: "東京都 */新宿区",
			changed:  true,
		},
		{
			name:     "mixed comments",
			input:    "東京都/* block */新宿区 // line comment",
			expected: "東京都新宿区",
			changed:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, changed := removeComments(tt.input)
			if result != tt.expected {
				t.Errorf("removeComments(%q) = %q, want %q", tt.input, result, tt.expected)
			}
			if changed != tt.changed {
				t.Errorf("removeComments(%q) changed = %v, want %v", tt.input, changed, tt.changed)
			}
		})
	}
}

func BenchmarkRemoveComments(b *testing.B) {
	testCases := []string{
		"東京都新宿区1-2-3",
		"東京都/* issue1 都道府県省略 */新宿区1-2-3",
		"東京都新宿区1-2-3 // some comment",
		"東京都/* issue1 */新宿区/* issue2 */1-2-3",
		"/* issue1 都道府県省略 */",
	}

	for _, tc := range testCases {
		b.Run("input_"+tc, func(b *testing.B) {
			for b.Loop() {
				removeComments(tc)
			}
		})
	}
}
