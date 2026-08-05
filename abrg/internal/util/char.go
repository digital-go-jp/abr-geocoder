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

// halfWidthKatakana maps each katakana to its half-width form. The two literals
// below have to stay in the same order.
var halfWidthKatakana = func() map[rune]rune {
	full := []rune("アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン")
	half := []rune("ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝ")
	m := make(map[rune]rune, len(full))
	for i, r := range full {
		m[r] = half[i]
	}
	return m
}()

// KanaSpellings returns s and every other kana spelling ABR records the same
// prefix in, starting with s itself. A search address holds full-width katakana
// because NFKC and the hiragana step put it there, while ABR writes an iroha
// prefix in half-width katakana or in hiragana depending on the municipality.
func KanaSpellings(s string) []string {
	spellings := []string{s}
	for _, alt := range []string{KatakanaToHalfWidth(s), KatakanaToHiragana(s)} {
		if alt != s {
			spellings = append(spellings, alt)
		}
	}
	return spellings
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

// KatakanaToHalfWidth narrows the katakana in s and leaves everything else as it
// is. ABR records an iroha parcel prefix in half-width katakana (イ402 is stored
// as ｲ402), while a search address has been through NFKC and holds the
// full-width form.
func KatakanaToHalfWidth(s string) string {
	return strings.Map(func(r rune) rune {
		if h, ok := halfWidthKatakana[r]; ok {
			return h
		}
		return r
	}, s)
}

// IsAddressNumberRune reports whether r is a digit used in Japanese address numbers.
// Includes ASCII digits, full-width digits, and kanji numerals.
func IsAddressNumberRune(r rune) bool {
	if char.IsASCIIDigit(r) || r >= '０' && r <= '９' {
		return true
	}
	return IsKanjiNumeral(r)
}
