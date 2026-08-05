package util

import (
	"strings"

	"abrg/internal/char"
)

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

// IsParcelNumberPrefix reports whether r can stand in front of the digits of a
// parcel number: one of the ten stems, the twelve branches or a katakana, which
// is how ABR writes the iroha letters. ABR keeps the prefix in prc_num1 (甲402)
// while an address writes it between the town name and the digits
// (白浜町甲402番地). A katakana that merely ends a town name answers yes as well;
// the parcel lookup is what tells the two apart.
func IsParcelNumberPrefix(r rune) bool {
	switch r {
	case '甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸',
		'子', '丑', '寅', '卯', '夘', '辰', '巳', '午', '未', '申', '酉', '戌', '亥':
		return true
	}
	return char.IsKatakanaNumberChar(r)
}

// The two katakana orders line up rune for rune, which is what the SQL that
// widens the cache columns relies on.
const (
	FullWidthKatakana = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン"
	HalfWidthKatakana = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝ"
)

// KanaSpellings returns s and every other kana spelling ABR records the same
// prefix in, starting with s itself. A search address holds full-width katakana,
// which is also what the cache holds, but some municipalities register an iroha
// prefix in hiragana and that spelling stands as it is.
func KanaSpellings(s string) []string {
	if hiragana := KatakanaToHiragana(s); hiragana != s {
		return []string{s, hiragana}
	}
	return []string{s}
}

// KatakanaToHiragana turns the katakana in s into hiragana and leaves everything
// else as it is. Some municipalities record an iroha parcel prefix in hiragana
// (い9), while a search address has had its hiragana turned into katakana.
func KatakanaToHiragana(s string) string {
	return strings.Map(func(r rune) rune {
		if char.IsKatakanaNumberChar(r) {
			return r - katakanaToHiraganaOffset
		}
		return r
	}, s)
}

// katakanaToHiraganaOffset is the distance between the two kana blocks, which
// run in the same order.
const katakanaToHiraganaOffset = 'ア' - 'あ'

// IsAddressNumberRune reports whether r is a digit used in Japanese address numbers.
// Includes ASCII digits, full-width digits, and kanji numerals.
func IsAddressNumberRune(r rune) bool {
	if char.IsASCIIDigit(r) || r >= '０' && r <= '９' {
		return true
	}
	return IsKanjiNumeral(r)
}
