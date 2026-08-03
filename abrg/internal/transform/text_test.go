package transform

import "testing"

func TestTextForBasicNormalized(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
		changed bool
	}{
		{
			name:    "empty string",
			input:   "",
			want:    "",
			changed: false,
		},
		{
			name:    "no change needed",
			input:   "東京都千代田区",
			want:    "東京都1000代田区",
			changed: true,
		},
		{
			name:    "skips StandardizeSpecialChars - keeps 塩竈",
			input:   "塩竈市",
			want:    "塩竈市", // 竈 is NOT converted because StandardizeSpecialChars is skipped
			changed: false,
		},
		{
			name:    "skips NFKC - keeps full-width numbers",
			input:   "千代田区１-３",    // Full-width numbers should remain (NFKC skipped)
			want:    "1000代田区１-３", // Kanji千converted to 1000; full-width numbers are kept because NFKC is skipped
			changed: true,         // Changed because千is converted
		},
		{
			name:    "with colon - address numbers",
			input:   "千代田区紀尾井町1-3",
			want:    "1000代田区紀尾井町:1-3",
			changed: true,
		},
		{
			name:    "hiragana to katakana",
			input:   "あま市西今宿",
			want:    "アマ市西今宿",
			changed: true,
		},
		{
			name:    "kanji numbers to arabic",
			input:   "一丁目",
			want:    "1@", // 丁目 → @ (chome symbol)
			changed: true,
		},
		{
			name:    "address with building name separator",
			input:   "三輪2-1-1",
			want:    "3輪:2-1-1",
			changed: true,
		},
		{
			name:    "sapporo kanji abbreviation",
			input:   "北三西一-7",
			want:    "北3条西1@:-7", // KanjiToArabic → expandSapporoJou → AddColon → ChomeToSymbol
			changed: true,
		},
		{
			// NormalizeSpaces collapses the run and drops the ideographic space.
			name:    "ideographic and repeated spaces are collapsed",
			input:   "名古屋市中区栄1丁目　　3",
			want:    "名古屋市中区栄1@ 3",
			changed: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, changed := TextForBasicNormalized(tt.input)
			if got != tt.want {
				t.Errorf("TextForBasicNormalized() got = %v, want %v", got, tt.want)
			}
			if changed != tt.changed {
				t.Errorf("TextForBasicNormalized() changed = %v, want %v", changed, tt.changed)
			}
		})
	}
}

// TestTextForDB pins the dbSteps pipeline that cache build runs as the
// normalize_text_go UDF. Every input is a real cache_machiaza row concatenated
// the way normalizedExpr concatenates it, so the want value is the
// normalized_address the cache actually stores.
func TestTextForDB(t *testing.T) {
	tests := []struct {
		name    string
		step    string
		input   string
		want    string
		changed bool
	}{
		{
			name:    "variant kanji 竈 becomes 釜",
			step:    "StandardizeSpecialChars",
			input:   "度会郡南伊勢町道行竈", // lg_code 244724 / machiaza_id 0036000
			want:    "度会郡南伊勢町道行釜",
			changed: true,
		},
		{
			name:    "compatibility ideograph 塚 U+FA10 becomes U+585A",
			step:    "NFKCNormalize",
			input:   "神戸市中央区割塚通7丁目", // lg_code 281107 / machiaza_id 0019007
			want:    "神戸市中央区割塚通7@",
			changed: true,
		},
		{
			name:    "horizontal bar U+2015 becomes a hyphen",
			step:    "NormalizeDashes",
			input:   "仙台市宮城野区小田原幸町公団アパ―ト", // lg_code 041025 / machiaza_id 0107000
			want:    "仙台市宮城野区小田原幸町公団アパ-ト",
			changed: true,
		},
		{
			// The prolonged sound mark converts only between digits, which is
			// why 公団アパート above keeps its ー.
			name:    "prolonged sound mark between digits becomes a hyphen",
			step:    "NormalizeDashes",
			input:   "知立市知立駅周17ー1街区", // lg_code 232254 / machiaza_id 0057000
			want:    "知立市知立駅周17-1街区",
			changed: true,
		},
		{
			name:    "大字 and 字 are dropped",
			step:    "RemoveOazaAza",
			input:   "厚岸郡浜中町大字後静村字姉別原野南9線", // lg_code 016632 / machiaza_id 0144172
			want:    "厚岸郡浜中町後静村姉別原野南9線",
			changed: true,
		},
		{
			name:    "hiragana の becomes katakana ノ",
			step:    "hiraganaToKatakana",
			input:   "倉敷市児島下の町9丁目", // lg_code 332020 / machiaza_id 0057009
			want:    "倉敷市児島下ノ町9@",
			changed: true,
		},
		{
			name:    "formal kanji numeral 壱 becomes 1",
			step:    "KanjiToArabic",
			input:   "上尾市壱丁目南", // lg_code 112194 / machiaza_id 0078000
			want:    "上尾市1@南",
			changed: true,
		},
		{
			name:    "丁目 becomes the chome symbol",
			step:    "ChomeToSymbol",
			input:   "浦安市舞浜2丁目", // lg_code 122271 / machiaza_id 0018002
			want:    "浦安市舞浜2@",
			changed: true,
		},
		{
			// AddColon is deliberately absent from dbSteps, so a trailing
			// number stays attached to the place name.
			name:    "no colon is inserted",
			step:    "AddColon is not in dbSteps",
			input:   "知立市知立駅周17ー1街区",
			want:    "知立市知立駅周17-1街区",
			changed: true,
		},
		{
			name:    "empty string",
			step:    "-",
			input:   "",
			want:    "",
			changed: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, changed := textForDB(tt.input)
			if got != tt.want {
				t.Errorf("textForDB(%q) [%s] = %q, want %q", tt.input, tt.step, got, tt.want)
			}
			if changed != tt.changed {
				t.Errorf("textForDB(%q) [%s] changed = %v, want %v", tt.input, tt.step, changed, tt.changed)
			}
		})
	}
}
