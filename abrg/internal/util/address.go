// Package util provides utility functions for address processing and formatting.
package util

import (
	"strings"
	"unicode"

	"abrg/internal/char"
)

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

// stripAzaMarker strips the "字" (aza) prefix from unmatched address components
// when it's just a marker rather than part of a meaningful place name.
//
// Strips "字" when:
//   - s is exactly "字" (standalone marker)
//   - the text after "字" ends with a kanji numeral (numbered koaza like "家六", "東三分一")
//
// Preserves "字" when the remaining text is a place name (e.g., "字上ノ原", "字堤下").
func stripAzaMarker(s string) string {
	if !strings.HasPrefix(s, "字") {
		return s
	}
	afterAza := strings.TrimPrefix(s, "字")
	if afterAza == "" {
		return ""
	}
	runes := []rune(afterAza)
	if isKanjiNumeral(runes[len(runes)-1]) {
		return afterAza
	}
	return s
}

// stripPrefecture removes prefecture prefix from address string.
// Note: Cannot use normalize.removePrefectureFromAddress here due to import cycle (util ↔ normalize).
func stripPrefecture(addr string) string {
	if strings.HasPrefix(addr, "北海道") {
		return addr[len("北海道"):]
	}
	runes := []rune(addr)
	for i, r := range runes {
		if (r == '都' || r == '府' || r == '県') && i >= 2 && i <= 3 {
			return string(runes[i+1:])
		}
		if i >= 4 {
			break
		}
	}
	return addr
}

// oazaAzaReplacer removes 大字 and 小字 patterns in a single pass.
var oazaAzaReplacer = strings.NewReplacer("大字", "", "小字", "")

// RemoveOazaAza removes 大字, 小字, and standalone 字 from address strings.
// Preserves "字" when preceded by a digit (e.g., "1字", "10字") as these are koaza names.
func RemoveOazaAza(s string) (string, bool) {
	if !strings.Contains(s, "字") {
		return s, false
	}

	orig := s
	s = oazaAzaReplacer.Replace(s)

	// Remove standalone 字, but preserve digit+字 patterns (koaza names)
	runes := []rune(s)
	var b strings.Builder
	b.Grow(len(s))

	for i, r := range runes {
		if r == '字' && (i == 0 || !unicode.IsDigit(runes[i-1])) {
			continue // Remove standalone 字
		}
		b.WriteRune(r)
	}

	result := b.String()
	return result, result != orig
}
