// Package util provides utility functions for address processing and formatting.
package util

import (
	"strings"

	"abrg/internal/char"
)

// ExtractTrailingAddressNumbers returns the trailing run of ASCII digits and
// hyphens from an address (e.g., "紀尾井町1-3" -> "1-3").
func ExtractTrailingAddressNumbers(searchAddr string) string {
	return extractTrailingBytes(searchAddr, func(b byte) bool {
		return char.IsASCIIDigit(b) || b == '-'
	})
}

// Used to extract chome (丁目) numbers from the portion before "@" in internal address format.
// Returns an empty string if s does not end with ASCII digits.
func ExtractChomeDigits(s string) string {
	return extractTrailingBytes(s, char.IsASCIIDigit)
}

func extractTrailingBytes(s string, match func(byte) bool) string {
	i := len(s) - 1
	for i >= 0 && match(s[i]) {
		i--
	}
	if i == len(s)-1 {
		return ""
	}
	return s[i+1:]
}

// MaxEditDistance computes the maximum edit distance threshold for fuzzy matching.
// Used by both machiaza (repository) and city (normalize) Levenshtein searches.
// DuckDB's editdist3 operates on bytes, so byteLen should be len(string), not len([]rune).
func MaxEditDistance(byteLen int) int {
	return max(byteLen/3, 3)
}

// oazaAzaReplacer removes 大字 and 小字 patterns in a single pass.
var oazaAzaReplacer = strings.NewReplacer("大字", "", "小字", "")

// RemoveOazaAza removes 大字, 小字, and standalone 字 from address strings.
// Preserves "字" when preceded by a numeral (e.g., "1字", "10字", "七字", "弐字")
// as these are koaza names.
func RemoveOazaAza(s string) (string, bool) {
	if !strings.Contains(s, "字") {
		return s, false
	}

	orig := s
	s = oazaAzaReplacer.Replace(s)

	// Remove standalone 字, but preserve numeral+字 patterns (koaza names)
	runes := []rune(s)
	var b strings.Builder
	b.Grow(len(s))

	for i, r := range runes {
		if r == '字' && (i == 0 || !IsAddressNumberRune(runes[i-1])) {
			continue // Remove standalone 字
		}
		b.WriteRune(r)
	}

	result := b.String()
	return result, result != orig
}
