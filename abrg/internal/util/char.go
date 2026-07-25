package util

// isKanjiNumeral reports whether r is a kanji numeral (一二三四五六七八九十〇百千).
// The set deliberately differs from transform's kanji-number set: 零/万/億
// never appear in address numbers, so they are excluded here.
func isKanjiNumeral(r rune) bool {
	switch r {
	case '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '〇', '百', '千':
		return true
	}
	return false
}

// IsAddressNumberRune reports whether r is a digit used in Japanese address numbers.
// Includes ASCII digits, full-width digits, and kanji numerals.
func IsAddressNumberRune(r rune) bool {
	if r >= '0' && r <= '9' || r >= '０' && r <= '９' {
		return true
	}
	return isKanjiNumeral(r)
}
