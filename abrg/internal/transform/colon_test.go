package transform

import (
	"testing"
)

func TestAddColon(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
		changed  bool
	}{
		{
			name:     "basic pattern with hyphen",
			input:    "三宅島三宅村伊ケ谷492-1",
			expected: "三宅島三宅村伊ケ谷:492-1",
			changed:  true,
		},
		{
			name:     "simple number suffix",
			input:    "東京都港区赤坂123",
			expected: "東京都港区赤坂:123",
			changed:  true,
		},
		{
			name:     "multiple hyphens",
			input:    "神奈川県横浜市中区山手町123-4-5",
			expected: "神奈川県横浜市中区山手町:123-4-5",
			changed:  true,
		},
		{
			name:     "no trailing number",
			input:    "東京都千代田区永田町",
			expected: "東京都千代田区永田町",
			changed:  false,
		},
		{
			name:     "already has colon",
			input:    "三宅島三宅村伊ケ谷:492-1",
			expected: "三宅島三宅村伊ケ谷:492-1",
			changed:  false,
		},
		{
			name:     "number in middle",
			input:    "東京都港区赤坂1丁目",
			expected: "東京都港区赤坂1丁目",
			changed:  false,
		},
		{
			name:     "ends with space and number",
			input:    "東京都港区赤坂 123",
			expected: "東京都港区赤坂 123",
			changed:  false,
		},
		{
			name:     "space-separated number after chome",
			input:    "名古屋市中区栄1丁目 3",
			expected: "名古屋市中区栄1丁目 3",
			changed:  false,
		},
		{
			name:     "space-separated multi-digit number after chome",
			input:    "中区栄1丁目 12",
			expected: "中区栄1丁目 12",
			changed:  false,
		},
		{
			name:     "ideographic-space-separated number after chome",
			input:    "名古屋市中区栄1丁目　3",
			expected: "名古屋市中区栄1丁目　3",
			changed:  false,
		},
		{
			name:     "ends with hyphen and number",
			input:    "東京都港区赤坂-123",
			expected: "東京都港区赤坂:-123",
			changed:  true,
		},
		{
			name:     "hyphen directly after chome",
			input:    "東京都中央区銀座1丁目-5-2",
			expected: "東京都中央区銀座1丁目:5-2",
			changed:  true,
		},
		{
			name:     "hyphen directly after chome, single number",
			input:    "東京都中央区銀座1丁目-5",
			expected: "東京都中央区銀座1丁目:5",
			changed:  true,
		},
		{
			name:     "katakana followed by number",
			input:    "イケ谷492",
			expected: "イケ谷:492",
			changed:  true,
		},
		{
			name:     "hiragana followed by number",
			input:    "いけや492",
			expected: "いけや:492",
			changed:  true,
		},
		{
			name:     "empty string",
			input:    "",
			expected: "",
			changed:  false,
		},
		{
			name:     "only numbers",
			input:    "123-456",
			expected: "123-456",
			changed:  false,
		},
		{
			name:     "complex address - town suffix with address number",
			input:    "東京都千代田区紀尾井町1-3",
			expected: "東京都千代田区紀尾井町:1-3",
			changed:  true,
		},
		// Special block/residential numbers
		{
			name:     "alphabet block number",
			input:    "上町A-20",
			expected: "上町:A-20",
			changed:  true,
		},
		{
			name:     "katakana residential number",
			input:    "児島下ノ町9丁目12-エ-46",
			expected: "児島下ノ町9丁目:12-エ-46",
			changed:  true,
		},
		{
			name:     "kanji block number after chome",
			input:    "久太郎町4丁目渡辺",
			expected: "久太郎町4丁目:渡辺",
			changed:  true,
		},
		{
			name:     "kanji block number with residential number",
			input:    "久太郎町4丁目渡辺-2",
			expected: "久太郎町4丁目:渡辺-2",
			changed:  true,
		},
		{
			name:     "丁目 + kanji block + number without 号 (渡辺3)",
			input:    "久太郎町4丁目渡辺3",
			expected: "久太郎町4丁目:渡辺-3",
			changed:  true,
		},
		// Hokkaido line addresses (数字+線)
		{
			name:     "Hokkaido line address - 南9線",
			input:    "厚岸郡浜中町後静村姉別原野南9線",
			expected: "厚岸郡浜中町後静村姉別原野南9線",
			changed:  false,
		},
		{
			name:     "Hokkaido line address - 北1線西",
			input:    "士別市温根別町北1線西",
			expected: "士別市温根別町北1線西",
			changed:  false,
		},
		{
			name:     "Hokkaido line address - 新野7線",
			input:    "釧路市新野7線",
			expected: "釧路市新野7線",
			changed:  false,
		},
		{
			name:     "alphabet block name without chome (A-12)",
			input:    "大阪市中央区上町A-12",
			expected: "大阪市中央区上町:A-12",
			changed:  true,
		},
		// Issue209: 町名に数字が含まれる場合
		{
			name:     "town name with number - 七軒町7-1",
			input:    "京都市東山区7軒町7-1",
			expected: "京都市東山区7軒町:7-1",
			changed:  true,
		},
		// Short digit patterns - now always add colon (chome handling moved to impl.go)
		{
			name:     "short digit pattern - 舞浜2-11",
			input:    "浦安市舞浜2-11",
			expected: "浦安市舞浜:2-11",
			changed:  true,
		},
		{
			name:     "short digit pattern - 三田2-2-18",
			input:    "港区3田2-2-18",
			expected: "港区3田:2-2-18",
			changed:  true,
		},
		// Suppression branches: these must NOT get a colon.
		{
			// 街区 koaza pattern (isGaikuPattern).
			name:     "gaiku pattern suppresses colon",
			input:    "宮崎県都城市平江町13街区5号",
			expected: "宮崎県都城市平江町13街区5号",
			changed:  false,
		},
		{
			// Sapporo abbreviation (北3西1...) is left for expandSapporoJou.
			name:     "sapporo abbreviation suppresses colon",
			input:    "北3西1-7",
			expected: "北3西1-7",
			changed:  false,
		},
		{
			// A trailing single katakana is likely a koaza, so the colon is reverted.
			name:     "trailing single katakana reverts colon",
			input:    "七尾市柑子町チ",
			expected: "七尾市柑子町チ",
			changed:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, changed := AddColon(tt.input)

			if result != tt.expected {
				t.Errorf("AddColon(%q) = %q, want %q",
					tt.input, result, tt.expected)
			}

			if changed != tt.changed {
				t.Errorf("AddColon(%q) changed = %v, want %v",
					tt.input, changed, tt.changed)
			}
		})
	}
}

func BenchmarkAddColon(b *testing.B) {
	testCases := []string{
		"三宅島三宅村伊ケ谷492-1",
		"東京都港区赤坂123",
		"神奈川県横浜市中区山手町123-4-5",
		"東京都千代田区永田町",
		"三宅島三宅村伊ケ谷:492-1",
	}

	for _, tc := range testCases {
		b.Run("input_"+tc[:min(20, len(tc))], func(b *testing.B) {
			for b.Loop() {
				AddColon(tc)
			}
		})
	}
}
