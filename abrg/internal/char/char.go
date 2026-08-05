// Package char provides shared character classification helpers for address
// processing. It sits below every other internal package and must stay free
// of dependencies.
package char

// IsASCIIDigit reports whether c is an ASCII digit ('0'–'9').
func IsASCIIDigit[T byte | rune](c T) bool {
	return c >= '0' && c <= '9'
}

// KatakanaNumberChars is the katakana range an address number is written with,
// as a regex character class. It leaves out the small kana and the long vowel
// mark, which only ever belong to a name.
const KatakanaNumberChars = "ア-ン"

// IsKatakanaNumberChar reports whether r is in KatakanaNumberChars.
func IsKatakanaNumberChar(r rune) bool {
	return r >= 'ア' && r <= 'ン'
}
