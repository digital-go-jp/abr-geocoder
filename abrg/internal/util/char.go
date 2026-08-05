package util

import "abrg/internal/char"

// IsKanjiNumeral reports whether r is a kanji numeral, either plain
// (一二三四五六七八九十〇零百千) or formal (壱弐参肆伍陸漆捌玖拾).
// The multipliers 万/億 are excluded: they carry a number only alongside a
// digit, and on their own they belong to ordinary place names (e.g. 万代町).
func IsKanjiNumeral(r rune) bool {
	switch r {
	case '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '〇', '零', '百', '千',
		'壱', '弐', '参', '肆', '伍', '陸', '漆', '捌', '玖', '拾':
		return true
	}
	return false
}

// IsParcelNumberPrefix reports whether r is one of the ten stems or twelve
// branches, which a parcel number can carry in front of its digits. ABR keeps
// the prefix in prc_num1 (甲402), while an address writes it between the town
// name and the digits (白浜町甲402番地).
//
// ABR uses the iroha letters the same way, but a katakana before the digits
// keeps AddColon from marking the number boundary at all, so those addresses
// never reach a parcel search. See #336.
func IsParcelNumberPrefix(r rune) bool {
	switch r {
	case '甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸',
		'子', '丑', '寅', '卯', '夘', '辰', '巳', '午', '未', '申', '酉', '戌', '亥':
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
