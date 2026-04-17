package normalize

import (
	"fmt"
	"testing"
)

func TestNFKCNormalize(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
		changed  bool
	}{
		{
			name:     "no change needed",
			input:    "test",
			expected: "test",
			changed:  false,
		},
		{
			name:     "full-width digits",
			input:    "１２３４５",
			expected: "12345",
			changed:  true,
		},
		{
			name:     "full-width letters",
			input:    "ＡＢＣａｂｃ",
			expected: "ABCabc",
			changed:  true,
		},
		{
			name:     "half-width katakana to full-width",
			input:    "ｱｲｳｴｵ",
			expected: "アイウエオ",
			changed:  true,
		},
		{
			name:     "half-width katakana with dakuten",
			input:    "ｶﾞｷﾞｸﾞｹﾞｺﾞ",
			expected: "ガギグゲゴ",
			changed:  true,
		},
		{
			name:     "half-width katakana with handakuten",
			input:    "ﾊﾟﾋﾟﾌﾟﾍﾟﾎﾟ",
			expected: "パピプペポ",
			changed:  true,
		},
		{
			name:     "mixed full-width characters",
			input:    "東京都１２３番地",
			expected: "東京都123番地",
			changed:  true,
		},
		{
			name:     "parentheses and symbols",
			input:    "（１２３）－４５６",
			expected: "(123)-456",
			changed:  true,
		},
		{
			name:     "complex address with katakana",
			input:    "東京都ﾄｳｷｮｳﾄﾐﾅﾄｸ１－２－３",
			expected: "東京都トウキョウトミナトク1-2-3",
			changed:  true,
		},
		{
			name:     "circled numbers",
			input:    "①②③④⑤",
			expected: "12345",
			changed:  true,
		},
		{
			name:     "roman numerals",
			input:    "ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ",
			expected: "IIIIIIIVVVIVIIVIIIIXX",
			changed:  true,
		},
		{
			name:     "square brackets",
			input:    "［１２３］",
			expected: "[123]",
			changed:  true,
		},
		{
			name:     "some dash variations",
			input:    "－",
			expected: "-",
			changed:  true,
		},
		{
			name:     "space variations",
			input:    "test　test",
			expected: "test test",
			changed:  true,
		},
		{
			name:     "already normalized",
			input:    "アイウエオ123ABC",
			expected: "アイウエオ123ABC",
			changed:  false,
		},
		{
			name:     "basic katakana",
			input:    "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝ",
			expected: "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン",
			changed:  true,
		},
		{
			name:     "voiced katakana",
			input:    "ｶﾞｷﾞｸﾞｹﾞｺﾞ",
			expected: "ガギグゲゴ",
			changed:  true,
		},
		{
			name:     "semi-voiced katakana",
			input:    "ﾊﾟﾋﾟﾌﾟﾍﾟﾎﾟ",
			expected: "パピプペポ",
			changed:  true,
		},
		{
			name:     "small katakana",
			input:    "ｧｨｩｪｫ",
			expected: "ァィゥェォ",
			changed:  true,
		},
		{
			name:     "long vowel mark",
			input:    "ｱｰｲｰ",
			expected: "アーイー",
			changed:  true,
		},
		// Test cases for "IfNeeded" behavior (now integrated)
		{
			name:     "already normalized - no processing",
			input:    "test123",
			expected: "test123",
			changed:  false,
		},
		{
			name:     "katakana already normalized",
			input:    "アイウエオ",
			expected: "アイウエオ",
			changed:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, changed := NFKCNormalize(tt.input)
			if result != tt.expected {
				t.Errorf("NFKCNormalize(%q) = %q, want %q", tt.input, result, tt.expected)
			}
			if changed != tt.changed {
				t.Errorf("NFKCNormalize(%q) changed = %v, want %v", tt.input, changed, tt.changed)
			}
		})
	}
}

func BenchmarkNFKCNormalize(b *testing.B) {
	testCases := []string{
		"test123",    // Already normalized
		"１２３４５",      // Full-width digits
		"ｱｲｳｴｵｶｷｸｹｺ", // Half-width katakana
		"東京都ﾄｳｷｮｳﾄﾐﾅﾄｸ１－２－３", // Complex mixed content
		"（１２３）－４５６－７８９０",     // Symbols and numbers
		"ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝ", // All basic katakana
	}

	for _, tc := range testCases {
		b.Run("len_"+fmt.Sprintf("%d", len(tc)), func(b *testing.B) {
			for b.Loop() {
				NFKCNormalize(tc)
			}
		})
	}
}
