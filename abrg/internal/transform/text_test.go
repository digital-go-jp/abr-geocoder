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
