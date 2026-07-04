package transform

import "testing"

func TestHiraganaToKatakana(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
		changed  bool
	}{
		{
			name:     "no hiragana",
			input:    "カタカナ",
			expected: "カタカナ",
			changed:  false,
		},
		{
			name:     "basic hiragana",
			input:    "あいうえお",
			expected: "アイウエオ",
			changed:  true,
		},
		{
			name:     "hiragana with dakuten",
			input:    "がぎぐげご",
			expected: "ガギグゲゴ",
			changed:  true,
		},
		{
			name:     "hiragana with handakuten",
			input:    "ぱぴぷぺぽ",
			expected: "パピプペポ",
			changed:  true,
		},
		{
			name:     "small hiragana",
			input:    "ぁぃぅぇぉ",
			expected: "ァィゥェォ",
			changed:  true,
		},
		{
			name:     "hiragana ya-yu-yo",
			input:    "ゃゅょ",
			expected: "ャュョ",
			changed:  true,
		},
		{
			name:     "hiragana tsu",
			input:    "っ",
			expected: "ッ",
			changed:  true,
		},
		{
			name:     "hiragana n",
			input:    "ん",
			expected: "ン",
			changed:  true,
		},
		{
			name:     "mixed hiragana and katakana",
			input:    "ひらがなカタカナ",
			expected: "ヒラガナカタカナ",
			changed:  true,
		},
		{
			name:     "all hiragana characters",
			input:    "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん",
			expected: "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン",
			changed:  true,
		},
		{
			name:     "hiragana in address context",
			input:    "のがわちょう",
			expected: "ノガワチョウ",
			changed:  true,
		},
		{
			name:     "mixed with kanji",
			input:    "東京都ちよだ区",
			expected: "東京都チヨダ区",
			changed:  true,
		},
		{
			name:     "hiragana particle no",
			input:    "たかしの",
			expected: "タカシノ",
			changed:  true,
		},
		{
			name:     "empty string",
			input:    "",
			expected: "",
			changed:  false,
		},
		{
			name:     "no change needed",
			input:    "123-456",
			expected: "123-456",
			changed:  false,
		},
		{
			name:     "hiragana with numbers",
			input:    "1ちょうめ2ばん",
			expected: "1チョウメ2バン",
			changed:  true,
		},
		{
			name:     "archaic hiragana wi-we",
			input:    "ゐゑ",
			expected: "ヰヱ",
			changed:  true,
		},
		{
			name:     "hiragana vu",
			input:    "ゔ",
			expected: "ヴ",
			changed:  true,
		},
		{
			name:     "real address example",
			input:    "とうきょうとちよだくきおいちょう",
			expected: "トウキョウトチヨダクキオイチョウ",
			changed:  true,
		},
		{
			name:     "hiragana small wa",
			input:    "ゎ",
			expected: "ヮ",
			changed:  true,
		},
		{
			// Iteration marks live in the U+309D-U+309F part of unicode.Hiragana.
			name:     "hiragana iteration marks",
			input:    "ゝゞ",
			expected: "ヽヾ",
			changed:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, changed := hiraganaToKatakana(tt.input)
			if result != tt.expected {
				t.Errorf("hiraganaToKatakana(%q) = %q, want %q", tt.input, result, tt.expected)
			}
			if changed != tt.changed {
				t.Errorf("hiraganaToKatakana(%q) changed = %v, want %v", tt.input, changed, tt.changed)
			}
		})
	}
}

func BenchmarkHiraganaToKatakana(b *testing.B) {
	testCases := []string{
		"カタカナ",     // No change
		"あいうえお",    // Basic hiragana
		"ひらがなカタカナ", // Mixed
		"とうきょうとちよだくきおいちょう",          // Real world example
		"あいうえおかきくけこさしすせそたちつてとなにぬねの", // Long hiragana string
	}

	for _, tc := range testCases {
		b.Run("input_"+tc, func(b *testing.B) {
			for b.Loop() {
				hiraganaToKatakana(tc)
			}
		})
	}
}
