package levenshtein

import (
	"strings"
	"testing"

	"abrg/internal/model"
)

func Test_isFullWidthDigit(t *testing.T) {
	tests := []struct {
		name string
		r    rune
		want bool
	}{
		{"full-width 0", '０', true},
		{"full-width 5", '５', true},
		{"full-width 9", '９', true},
		{"half-width 0", '0', false},
		{"half-width 9", '9', false},
		{"non-digit", 'あ', false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isFullWidthDigit(tt.r); got != tt.want {
				t.Errorf("isFullWidthDigit(%q) = %v, want %v", tt.r, got, tt.want)
			}
		})
	}
}

func Test_toHalfWidthDigit(t *testing.T) {
	tests := []struct {
		name string
		r    rune
		want rune
	}{
		{"０ -> 0", '０', '0'},
		{"５ -> 5", '５', '5'},
		{"９ -> 9", '９', '9'},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := toHalfWidthDigit(tt.r); got != tt.want {
				t.Errorf("toHalfWidthDigit(%q) = %q, want %q", tt.r, got, tt.want)
			}
		})
	}
}

func Test_isFullWidthHyphen(t *testing.T) {
	tests := []struct {
		name string
		r    rune
		want bool
	}{
		{"minus sign", '−', true},
		{"full-width hyphen-minus", '－', true},
		{"katakana prolonged sound mark", 'ー', true},
		{"em dash", '—', true},
		{"horizontal bar", '―', true},
		{"half-width hyphen", '-', false},
		{"underscore", '_', false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isFullWidthHyphen(tt.r); got != tt.want {
				t.Errorf("isFullWidthHyphen(%q) = %v, want %v", tt.r, got, tt.want)
			}
		})
	}
}

func TestNormalizeUnmatchedNumbers(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "full-width digits to half-width",
			input: "１９２６",
			want:  "1926",
		},
		{
			name:  "full-width hyphen to half-width",
			input: "１−２",
			want:  "1-2",
		},
		{
			name:  "番地 to hyphen",
			input: "1926番地1",
			want:  "1926-1",
		},
		{
			name:  "番 followed by number to hyphen",
			input: "1926番1",
			want:  "1926-1",
		},
		{
			name:  "trailing 号 removed",
			input: "1号",
			want:  "1",
		},
		{
			name:  "complex pattern",
			input: "東三分一１９２６番地１",
			want:  "東三分一1926-1",
		},
		{
			name:  "trailing hyphen removed",
			input: "2013番地",
			want:  "2013",
		},
		{
			name:  "no change needed",
			input: "名字八五十2459",
			want:  "名字八五十2459",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := NormalizeUnmatchedNumbers(tt.input); got != tt.want {
				t.Errorf("NormalizeUnmatchedNumbers(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestMatchesPlaceName(t *testing.T) {
	tests := []struct {
		name          string
		placeName     *string
		searchNumbers string
		stripSuffix   func(string) string
		want          bool
	}{
		{
			name:          "nil placeName",
			placeName:     nil,
			searchNumbers: "3",
			stripSuffix:   nil,
			want:          false,
		},
		{
			name:          "empty searchNumbers",
			placeName:     new("三丁目"),
			searchNumbers: "",
			stripSuffix:   nil,
			want:          false,
		},
		{
			name:          "direct match with kanji normalized",
			placeName:     new("三五十"),
			searchNumbers: "3510",
			stripSuffix:   nil,
			want:          true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := matchesPlaceName(tt.placeName, tt.searchNumbers, tt.stripSuffix); got != tt.want {
				t.Errorf("matchesPlaceName() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestAdjustSearchAddrForChome(t *testing.T) {
	tests := []struct {
		name          string
		addr          *model.StructuredAddress
		searchNumbers string
		searchAddr    string
		want          string
	}{
		{
			name:          "nil chome",
			addr:          &model.StructuredAddress{Chome: nil},
			searchNumbers: "3-1-5",
			searchAddr:    "3-1-5",
			want:          "3-1-5",
		},
		{
			name:          "chome matches prefix",
			addr:          &model.StructuredAddress{Chome: new("3丁目")},
			searchNumbers: "3-1-5",
			searchAddr:    "3-1-5",
			want:          "1-5",
		},
		{
			name:          "chome does not match prefix",
			addr:          &model.StructuredAddress{Chome: new("5丁目")},
			searchNumbers: "3-1-5",
			searchAddr:    "3-1-5",
			want:          "3-1-5",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := adjustSearchAddrForChome(tt.addr, tt.searchNumbers, tt.searchAddr); got != tt.want {
				t.Errorf("adjustSearchAddrForChome() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestContainsDigit(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  bool
	}{
		{"ASCII digit", "123", true},
		{"ASCII digit mixed", "abc123", true},
		{"no digit", "abc", false},
		{"empty string", "", false},
		{"full-width digits (not detected)", "１２３", false},
		{"kanji numerals (not detected)", "一二三", false},
		{"Japanese text with ASCII digit", "ヤドミ1", true},
		{"purely Japanese text", "ヤドミ", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := strings.ContainsAny(tt.input, "0123456789"); got != tt.want {
				t.Errorf("ContainsAny(%q) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

func TestExtractUnmatchedFromStandardized(t *testing.T) {
	tests := []struct {
		name         string
		originalAddr string
		matchedAddr  string
		want         []string
	}{
		{
			name:         "simple unmatched suffix",
			originalAddr: "香川県丸亀市原田町字東三分一1926-1",
			matchedAddr:  "香川県丸亀市原田町",
			want:         []string{"東三分一1926-1"},
		},
		{
			name:         "with building name",
			originalAddr: "東京都千代田区丸の内1-1-1 ビル名",
			matchedAddr:  "東京都千代田区丸の内",
			want:         []string{"1-1-1", "ビル名"},
		},
		{
			name:         "全角スペース",
			originalAddr: "東京都千代田区丸の内1-1-1　ビル名",
			matchedAddr:  "東京都千代田区丸の内",
			want:         []string{"1-1-1", "ビル名"},
		},
		{
			name:         "大字 in matchedAddr only",
			originalAddr: "長野県千曲市磯部字下河原1137",
			matchedAddr:  "長野県千曲市大字磯部",
			want:         []string{"下河原1137"},
		},
		{
			name:         "大字 in both addresses",
			originalAddr: "大分県宇佐市安心院町大字古川長坂",
			matchedAddr:  "大分県宇佐市安心院町大字古川",
			want:         []string{"長坂"},
		},
		{
			name:         "字 in originalAddr only",
			originalAddr: "香川県丸亀市原田町字東三分一1926-1",
			matchedAddr:  "香川県丸亀市原田町東三分一",
			want:         []string{"1926-1"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractUnmatchedSegments(tt.originalAddr, tt.matchedAddr)
			if len(got) != len(tt.want) {
				t.Errorf("extractUnmatchedSegments() = %v, want %v", got, tt.want)
				return
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Errorf("extractUnmatchedSegments()[%d] = %q, want %q", i, got[i], tt.want[i])
				}
			}
		})
	}
}

func TestIsSearchNumbersPartOfPlaceName(t *testing.T) {
	tests := []struct {
		name          string
		addr          model.StructuredAddress
		searchNumbers string
		want          bool
	}{
		{
			name:          "koaza with 号 suffix matches the number",
			addr:          model.StructuredAddress{Koaza: new("4号")},
			searchNumbers: "4",
			want:          true,
		},
		{
			name:          "chome with 丁目 suffix matches the number",
			addr:          model.StructuredAddress{Chome: new("3丁目")},
			searchNumbers: "3",
			want:          true,
		},
		{
			name:          "no place-name fields set",
			addr:          model.StructuredAddress{},
			searchNumbers: "5",
			want:          false,
		},
		{
			name:          "empty searchNumbers",
			addr:          model.StructuredAddress{Koaza: new("4号")},
			searchNumbers: "",
			want:          false,
		},
		{
			name:          "number does not match any place name",
			addr:          model.StructuredAddress{Koaza: new("本町")},
			searchNumbers: "1",
			want:          false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsSearchNumbersPartOfPlaceName(&tt.addr, tt.searchNumbers); got != tt.want {
				t.Errorf("IsSearchNumbersPartOfPlaceName(%+v, %q) = %v, want %v", tt.addr, tt.searchNumbers, got, tt.want)
			}
		})
	}
}
