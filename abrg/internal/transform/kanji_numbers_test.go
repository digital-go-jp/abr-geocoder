package transform

import "testing"

func TestKanjiToArabic(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
		changed  bool
	}{
		{
			name:     "no change needed",
			input:    "123-456",
			expected: "123-456",
			changed:  false,
		},
		{
			name:     "single kanji number one",
			input:    "一番地",
			expected: "1番地",
			changed:  true,
		},
		{
			name:     "single kanji number two",
			input:    "二丁目",
			expected: "2丁目",
			changed:  true,
		},
		{
			name:     "kanji number ten",
			input:    "十番",
			expected: "10番",
			changed:  true,
		},
		{
			name:     "kanji zero variations",
			input:    "零号〇番",
			expected: "0号0番",
			changed:  true,
		},
		{
			name:     "multiple kanji numbers",
			input:    "一丁目二番三号",
			expected: "1丁目2番3号",
			changed:  true,
		},
		{
			name:     "all single digits",
			input:    "一二三四五六七八九",
			expected: "123456789",
			changed:  true,
		},
		{
			name:     "mixed kanji and arabic",
			input:    "一丁目2番三号",
			expected: "1丁目2番3号",
			changed:  true,
		},
		{
			name:     "empty string",
			input:    "",
			expected: "",
			changed:  false,
		},
		{
			name:     "real address example - chiyoda ward",
			input:    "東京都千代田区一丁目二番三号",
			expected: "東京都1000代田区1丁目2番3号",
			changed:  true,
		},
		{
			name:     "complex address with ten",
			input:    "栄町十番地",
			expected: "栄町10番地",
			changed:  true,
		},
		{
			name:     "no kanji numbers",
			input:    "アパート名前",
			expected: "アパート名前",
			changed:  false,
		},
		{
			name:     "formal kanji numbers",
			input:    "壱弐参肆伍陸漆捌玖拾",
			expected: "12345678910", // 拾 at end not followed by digit, treated as 10
			changed:  true,
		},
		{
			name:     "formal kanji mix",
			input:    "壱丁目弐番参号",
			expected: "1丁目2番3号",
			changed:  true,
		},
		{
			name:     "formal kanji with arabic",
			input:    "壱丁目1番参号",
			expected: "1丁目1番3号",
			changed:  true,
		},
		{
			name:     "compound number twenty-four",
			input:    "二十四軒二丁目",
			expected: "24軒2丁目",
			changed:  true,
		},
		{
			name:     "formal kanji ichi repeated",
			input:    "壱壱壱部25",
			expected: "111部25",
			changed:  true,
		},
		{
			name:     "compound number twelve",
			input:    "十二所",
			expected: "12所",
			changed:  true,
		},
		{
			name:     "compound number thirty-eight",
			input:    "三十八社町",
			expected: "38社町",
			changed:  true,
		},
		{
			name:     "complex address with compound numbers",
			input:    "西六線北二十六号",
			expected: "西6線北26号",
			changed:  true,
		},
		{
			name:     "east fifteen conditions",
			input:    "東十五条南",
			expected: "東15条南",
			changed:  true,
		},
		{
			name:     "ninety-nine ri town",
			input:    "九十九里町",
			expected: "99里町",
			changed:  true,
		},
		{
			name:     "nine nine ten sequence",
			input:    "九九十",
			expected: "9910", // 十 not followed by digit, treated separately
			changed:  true,
		},
		{
			name:     "three five ten sequence (place name)",
			input:    "三五十",
			expected: "3510", // 三=3, 五=5, 十=10 as separate digits (actual place name in Aichi)
			changed:  true,
		},
		{
			name:     "formal kanji with zero in middle",
			input:    "石川県鹿島郡中能登町ABC壱〇弐",
			expected: "石川県鹿島郡中能登町ABC102",
			changed:  true,
		},
		{
			name:     "single one at end",
			input:    "マンション名一",
			expected: "マンション名1",
			changed:  true,
		},
		{
			name:     "complex address with multiple compound numbers",
			input:    "二十五丁目三十一番地",
			expected: "25丁目31番地",
			changed:  true,
		},
		{
			name:     "twenty-four three one complex",
			input:    "二十四軒三条一丁目",
			expected: "24軒3条1丁目",
			changed:  true,
		},
		{
			name:     "mixed large and small numbers",
			input:    "神浜市四百四十四丁目マンション三〇二号室",
			expected: "神浜市444丁目マンション302号室",
			changed:  true,
		},
		{
			name:     "kanji zero only",
			input:    "神浜市四百四十四丁目マンション零号室",
			expected: "神浜市444丁目マンション0号室",
			changed:  true,
		},
		{
			name:     "hundred one pattern",
			input:    "百一番地",
			expected: "101番地",
			changed:  true,
		},
		{
			name:     "two hundred one pattern",
			input:    "二百一番地",
			expected: "201番地",
			changed:  true,
		},
		{
			name:     "three hundred five pattern",
			input:    "三百五号",
			expected: "305号",
			changed:  true,
		},
		{
			name:     "bare hundred",
			input:    "百番地",
			expected: "100番地",
			changed:  true,
		},
		{
			name:     "twenty only (Issue #193)",
			input:    "東二十号南",
			expected: "東20号南",
			changed:  true,
		},
		{
			name:     "thirty only",
			input:    "三十条",
			expected: "30条",
			changed:  true,
		},
		{
			name:     "irregular place name - toyoda",
			input:    "愛知県豊田市西丹波町三五十",
			expected: "愛知県豊田市西丹波町3510",
			changed:  true,
		},
		{
			name:     "tokachi place name - hokkaido",
			input:    "北海道十勝郡",
			expected: "北海道10勝郡",
			changed:  true,
		},
		{
			name:     "yotsukaichi place name - mie",
			input:    "三重県四日市市",
			expected: "3重県4日市市",
			changed:  true,
		},
		{
			name:     "yachiyo place name - chiba",
			input:    "八千代市",
			expected: "8000代市",
			changed:  true,
		},
		{
			name:     "ten thousand - 万",
			input:    "一万",
			expected: "10000",
			changed:  true,
		},
		{
			name:     "twelve thousand - 一万二千",
			input:    "一万二千",
			expected: "12000",
			changed:  true,
		},
		{
			name:     "one million - 百万",
			input:    "百万",
			expected: "1000000",
			changed:  true,
		},
		{
			name:     "eleven million one hundred eleven thousand - 一千百万",
			input:    "一千百万",
			expected: "11000000",
			changed:  true,
		},
		{
			name:     "one hundred million - 一億",
			input:    "一億",
			expected: "100000000",
			changed:  true,
		},
		{
			name:     "one billion - 十億",
			input:    "十億",
			expected: "1000000000",
			changed:  true,
		},
		{
			name:     "eleven million one hundred eleven thousand one hundred eleven - 千百十一万千百十一",
			input:    "千百十一万千百十一",
			expected: "11111111",
			changed:  true,
		},
		{
			name:     "nine hundred ninety-nine thousand nine hundred ninety-nine - 九十九万九千九百九十九",
			input:    "九十九万九千九百九十九",
			expected: "999999",
			changed:  true,
		},
		{
			name:     "one hundred thousand - 十万",
			input:    "十万",
			expected: "100000",
			changed:  true,
		},
		{
			name:     "ten million - 千万",
			input:    "千万",
			expected: "10000000",
			changed:  true,
		},
		{
			name:     "nine hundred ninety thousand - 九十九万",
			input:    "九十九万",
			expected: "990000",
			changed:  true,
		},
		{
			name:     "one hundred one with zero - 百零一 (individual digit processing)",
			input:    "百零一",
			expected: "10001",
			changed:  true,
		},
		{
			name:     "one thousand one with zero - 千零一 (individual digit processing)",
			input:    "千零一",
			expected: "100001",
			changed:  true,
		},
		{
			name:     "ninety-nine billion - 九十九億",
			input:    "九十九億",
			expected: "9900000000",
			changed:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, changed := KanjiToArabic(tt.input)
			if result != tt.expected {
				t.Errorf("KanjiToArabic(%q) = %q, want %q", tt.input, result, tt.expected)
			}
			if changed != tt.changed {
				t.Errorf("KanjiToArabic(%q) changed = %v, want %v", tt.input, changed, tt.changed)
			}
		})
	}
}

func BenchmarkKanjiToArabic(b *testing.B) {
	testCases := []string{
		"123-456", // No change
		"一番地",     // Single kanji
		"一丁目二番三号", // Multiple kanji
		"東京都千代田区一丁目二番三号", // Real world example
		"一二三四五六七八九十",     // All digits
		"百一番地",           // Hundred one pattern
		"二百一番地",          // Two hundred one pattern
		"三百五号",           // Three hundred five pattern
	}

	for _, tc := range testCases {
		b.Run("input_"+tc, func(b *testing.B) {
			for b.Loop() {
				KanjiToArabic(tc)
			}
		})
	}
}

func TestKanjiNoToHyphen(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
		changed  bool
	}{
		{
			name:     "no change - no kanji numbers",
			input:    "東京都新宿区西新宿",
			expected: "東京都新宿区西新宿",
			changed:  false,
		},
		{
			name:     "no change - no ノ or の",
			input:    "東京都新宿区西新宿二丁目",
			expected: "東京都新宿区西新宿二丁目",
			changed:  false,
		},
		{
			name:     "simple kanji no kanji",
			input:    "二ノ八",
			expected: "2-8",
			changed:  true,
		},
		{
			name:     "chained kanji no kanji",
			input:    "二ノ八ノ一",
			expected: "2-8-1",
			changed:  true,
		},
		{
			name:     "with address prefix",
			input:    "西新宿二ノ八ノ一",
			expected: "西新宿2-8-1",
			changed:  true,
		},
		{
			name:     "compound kanji numbers",
			input:    "十二ノ三",
			expected: "12-3",
			changed:  true,
		},
		{
			name:     "hiragana no",
			input:    "二の八の一",
			expected: "2-8-1",
			changed:  true,
		},
		{
			name:     "mixed hiragana and katakana no",
			input:    "二の八ノ一",
			expected: "2-8-1",
			changed:  true,
		},
		{
			name:     "formal kanji numbers",
			input:    "弐ノ八ノ壱",
			expected: "2-8-1",
			changed:  true,
		},
		{
			name:     "tens compound left",
			input:    "二十ノ三",
			expected: "20-3",
			changed:  true,
		},
		{
			name:     "tens compound right",
			input:    "三ノ十二",
			expected: "3-12",
			changed:  true,
		},
		{
			name:     "tens compound both",
			input:    "二十ノ十二",
			expected: "20-12",
			changed:  true,
		},
		{
			name:     "real address example",
			input:    "東京都新宿区西新宿二ノ八ノ一",
			expected: "東京都新宿区西新宿2-8-1",
			changed:  true,
		},
		{
			name:     "arabic no arabic chained",
			input:    "2ノ8ノ1",
			expected: "2-8-1",
			changed:  true,
		},
		// Edge cases
		{
			name:     "four chained kanji numbers",
			input:    "一ノ二ノ三ノ四",
			expected: "1-2-3-4",
			changed:  true,
		},
		{
			name:     "five chained kanji numbers",
			input:    "一ノ二ノ三ノ四ノ五",
			expected: "1-2-3-4-5",
			changed:  true,
		},
		{
			name:     "single kanji both sides",
			input:    "一ノ一",
			expected: "1-1",
			changed:  true,
		},
		{
			name:     "mixed with text before and after",
			input:    "字西浦二ノ三甲",
			expected: "字西浦2-3甲",
			changed:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, changed := kanjiNoToHyphen(tt.input)
			if result != tt.expected {
				t.Errorf("kanjiNoToHyphen(%q) = %q, want %q", tt.input, result, tt.expected)
			}
			if changed != tt.changed {
				t.Errorf("kanjiNoToHyphen(%q) changed = %v, want %v", tt.input, changed, tt.changed)
			}
		})
	}
}
