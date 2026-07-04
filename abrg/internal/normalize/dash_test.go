package normalize

import "testing"

func TestNormalizeDashes(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
		changed  bool
	}{
		{
			name:     "no dash",
			input:    "東京都千代田区紀尾井町",
			expected: "東京都千代田区紀尾井町",
			changed:  false,
		},
		{
			name:     "already normalized dash",
			input:    "1-2-3",
			expected: "1-2-3",
			changed:  false,
		},
		{
			name:     "fullwidth hyphen-minus",
			input:    "1－2－3",
			expected: "1-2-3",
			changed:  true,
		},
		{
			name:     "en dash",
			input:    "1–2–3",
			expected: "1-2-3",
			changed:  true,
		},
		{
			name:     "em dash",
			input:    "1—2—3",
			expected: "1-2-3",
			changed:  true,
		},
		{
			name:     "katakana prolonged sound mark between numbers",
			input:    "1ー2ー3",
			expected: "1-2-3",
			changed:  true,
		},
		{
			name:     "katakana prolonged sound mark in word",
			input:    "ガーデンテラス",
			expected: "ガーデンテラス",
			changed:  false,
		},
		{
			name:     "wave dash",
			input:    "1〜2〜3",
			expected: "1-2-3",
			changed:  true,
		},
		{
			name:     "mixed dash types",
			input:    "1－2–3—4ー5",
			expected: "1-2-3-4-5",
			changed:  true,
		},
		{
			name:     "dash in address",
			input:    "東京都千代田区紀尾井町1－2－3",
			expected: "東京都千代田区紀尾井町1-2-3",
			changed:  true,
		},
		{
			name:     "figure dash",
			input:    "1‒2‒3",
			expected: "1-2-3",
			changed:  true,
		},
		{
			name:     "horizontal bar",
			input:    "1―2―3",
			expected: "1-2-3",
			changed:  true,
		},
		{
			name:     "minus sign",
			input:    "1−2−3",
			expected: "1-2-3",
			changed:  true,
		},
		{
			name:     "complex address with fullwidth dash",
			input:    "東京都千代田区紀尾井町１－２－３東京ガーデンテラス",
			expected: "東京都千代田区紀尾井町１-２-３東京ガーデンテラス",
			changed:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, changed := NormalizeDashes(tt.input)
			if result != tt.expected {
				t.Errorf("NormalizeDashes(%q) = %q, want %q", tt.input, result, tt.expected)
			}
			if changed != tt.changed {
				t.Errorf("NormalizeDashes(%q) changed = %v, want %v", tt.input, changed, tt.changed)
			}
		})
	}
}
