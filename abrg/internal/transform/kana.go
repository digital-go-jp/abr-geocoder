package transform

import (
	"strings"
	"unicode"
)

// hiraganaToKatakana converts hiragana characters to katakana.
func hiraganaToKatakana(s string) (string, bool) {
	changed := false
	result := strings.Map(func(r rune) rune {
		// Hiragana range: U+3041-U+3096 and U+309D-U+309F
		if unicode.In(r, unicode.Hiragana) {
			// Katakana offset is +96 (0x60) from Hiragana
			changed = true
			return r + 0x60
		}
		return r
	}, s)
	return result, changed
}
