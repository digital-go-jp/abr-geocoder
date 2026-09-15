package normalize

import "testing"

func TestRemoveDefaultIgnorable(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "no ignorable characters",
			input:    "愛媛県松山市",
			expected: "愛媛県松山市",
		},
		{
			name:     "IVS U+E0103 after 媛 (Issue #236)",
			input:    "愛媛\U000E0103県松山市",
			expected: "愛媛県松山市",
		},
		{
			name:     "SVS U+FE00",
			input:    "東京\uFE00都",
			expected: "東京都",
		},
		{
			name:     "leading BOM U+FEFF",
			input:    "\uFEFF東京都千代田区",
			expected: "東京都千代田区",
		},
		{
			name:     "zero width space, joiners and direction marks U+200B-U+200F",
			input:    "\u200B東\u200C京\u200D都\u200E千代田\u200F区",
			expected: "東京都千代田区",
		},
		{
			name:     "soft hyphen U+00AD",
			input:    "千代\u00AD田区",
			expected: "千代田区",
		},
		{
			name:     "word joiner U+2060 and bidi embedding U+202A",
			input:    "\u202A千代田区\u2060",
			expected: "千代田区",
		},
		{
			name:     "hangul filler U+3164",
			input:    "千代田区\u3164",
			expected: "千代田区",
		},
		{
			name:     "tag U+E0001",
			input:    "千代田区\U000E0001",
			expected: "千代田区",
		},
		{
			name:     "invalid UTF-8 without ignorable characters is left as is",
			input:    "千代田区\xff",
			expected: "千代田区\xff",
		},
		{
			name:     "invalid UTF-8 next to a removed selector reports the change",
			input:    "千代田\U000E0103区\xff\xff",
			expected: "千代田区\uFFFD\uFFFD",
		},
		{
			name:     "ideographic space U+3000 kept for NormalizeSpaces",
			input:    "東京都\u3000千代田区",
			expected: "東京都\u3000千代田区",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, changed := RemoveDefaultIgnorable(tt.input)
			if result != tt.expected {
				t.Errorf("RemoveDefaultIgnorable(%q) = %q, want %q", tt.input, result, tt.expected)
			}
			if want := tt.input != tt.expected; changed != want {
				t.Errorf("RemoveDefaultIgnorable(%q) changed = %v, want %v", tt.input, changed, want)
			}
		})
	}
}
