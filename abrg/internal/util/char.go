package util

import "abrg/internal/char"

// IsKanjiNumeral reports whether r is a kanji numeral, either plain
// (一二三四五六七八九十〇百千) or formal (壱弐参肆伍陸漆捌玖拾). Older koaza names use
// the formal digits, e.g. "七弐字".
// The set deliberately differs from transform's kanji-number set: 零/万/億
// never appear in address numbers, so they are excluded here.
func IsKanjiNumeral(r rune) bool {
	switch r {
	case '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '〇', '百', '千',
		'壱', '弐', '参', '肆', '伍', '陸', '漆', '捌', '玖', '拾':
		return true
	}
	return false
}

// IsAddressNumberRune reports whether r is a digit used in Japanese address numbers.
// Includes ASCII digits, full-width digits, and kanji numerals.
func IsAddressNumberRune(r rune) bool {
	if char.IsASCIIDigit(r) || r >= '０' && r <= '９' {
		return true
	}
	return IsKanjiNumeral(r)
}
