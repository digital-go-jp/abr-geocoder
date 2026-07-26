package util

import "testing"

func Test_IsKanjiNumeral(t *testing.T) {
	tests := []struct {
		name string
		r    rune
		want bool
	}{
		{"一", '一', true},
		{"二", '二', true},
		{"三", '三', true},
		{"四", '四', true},
		{"五", '五', true},
		{"六", '六', true},
		{"七", '七', true},
		{"八", '八', true},
		{"九", '九', true},
		{"十", '十', true},
		{"〇", '〇', true},
		{"百", '百', true},
		{"千", '千', true},
		{"formal 壱", '壱', false},
		{"formal 弐", '弐', false},
		{"formal 参", '参', false},
		{"hiragana", 'あ', false},
		{"ASCII digit", '5', false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsKanjiNumeral(tt.r); got != tt.want {
				t.Errorf("IsKanjiNumeral(%q) = %v, want %v", tt.r, got, tt.want)
			}
		})
	}
}

func TestIsAddressNumberRune(t *testing.T) {
	tests := []struct {
		name string
		r    rune
		want bool
	}{
		{"ASCII 0", '0', true},
		{"ASCII 9", '9', true},
		{"full-width ０", '０', true},
		{"full-width ９", '９', true},
		{"kanji 一", '一', true},
		{"kanji 五", '五', true},
		{"kanji 十", '十', true},
		{"kanji 百", '百', true},
		{"kanji 千", '千', true},
		{"kanji 〇", '〇', true},
		{"formal 壱", '壱', false},
		{"formal 弐", '弐', false},
		{"formal 参", '参', false},
		{"hiragana", 'あ', false},
		{"katakana", 'ア', false},
		{"hyphen", '-', false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsAddressNumberRune(tt.r); got != tt.want {
				t.Errorf("IsAddressNumberRune(%q) = %v, want %v", tt.r, got, tt.want)
			}
		})
	}
}
