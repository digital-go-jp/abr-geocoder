package transform

import "testing"

func TestIsHokkaidoSenPattern(t *testing.T) {
	tests := []struct {
		input string
		want  bool
	}{
		// Real data from DuckDB cache_machiaza
		{"7線", true},
		{"10線", true},
		{"上川郡鷹栖町7線", true},
		{"旭川市西神楽2線", true},
		{"旭川市西神楽1線", true},  // 西神楽1線 (oaza_cho in DB)
		{"旭川市東鷹栖11線", true}, // 東鷹栖11線 (oaza_cho in DB)
		{"旭川市東鷹栖12線", true}, // 東鷹栖12線 (oaza_cho in DB)
		// Not Hokkaido sen pattern
		{"上条", false},
		{"下条", false},
		{"北条町", false},
		{"線", false},  // no number before 線
		{"一線", false}, // kanji number, not digit
		{"標津郡標津町茶志骨6線南", false}, // ends with 南, not 線
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := isHokkaidoSenPattern(tt.input)
			if got != tt.want {
				t.Errorf("isHokkaidoSenPattern(%q) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

func TestIsSenGoPattern(t *testing.T) {
	tests := []struct {
		input string
		want  bool
	}{
		{"上川郡鷹栖町7線:1号", true},
		{"旭川市西神楽2線:34号", true},
		{"旭川市東鷹栖11線:16号", true},
		// Not sen-go pattern
		{"小松市軽海町ノ:14-1", false}, // no 線 before colon
		{"札幌市中央区北3条西:1", false}, // 条, not 線
		{"上川郡鷹栖町7線1号", false},   // no colon
		{"上川郡鷹栖町7線:", false},    // empty after colon
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := IsSenGoPattern(tt.input)
			if got != tt.want {
				t.Errorf("IsSenGoPattern(%q) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

func TestExtractSenGoSuffix(t *testing.T) {
	tests := []struct {
		input      string
		wantBase   string
		wantSuffix string
		wantFound  bool
	}{
		// Real data from DuckDB cache_machiaza (normalized_address)
		{"旭川市西神楽1線13号", "旭川市西神楽1線", "13号", true},
		{"旭川市西神楽1線12号", "旭川市西神楽1線", "12号", true},
		{"旭川市西神楽1線25号", "旭川市西神楽1線", "25号", true},
		{"旭川市西神楽2線10号", "旭川市西神楽2線", "10号", true},
		{"旭川市西神楽4線10号", "旭川市西神楽4線", "10号", true},
		{"旭川市東鷹栖11線23号", "旭川市東鷹栖11線", "23号", true},
		{"旭川市東鷹栖12線22号", "旭川市東鷹栖12線", "22号", true},
		// With direction (方角)
		{"旭川市近文7線南1号", "旭川市近文7線南", "1号", true},
		// Not extractable
		{"上川郡鷹栖町7線", "", "", false},      // no 号
		{"標津郡標津町茶志骨6線南", "", "", false},  // 6線南 is oaza_cho, not sen-go
		{"札幌市中央区北3条西1丁目", "", "", false}, // 条, not 線
		{"", "", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			gotBase, gotSuffix, gotFound := ExtractSenGoSuffix(tt.input)
			if gotBase != tt.wantBase || gotSuffix != tt.wantSuffix || gotFound != tt.wantFound {
				t.Errorf("ExtractSenGoSuffix(%q) = (%q, %q, %v), want (%q, %q, %v)",
					tt.input, gotBase, gotSuffix, gotFound, tt.wantBase, tt.wantSuffix, tt.wantFound)
			}
		})
	}
}
