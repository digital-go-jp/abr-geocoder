package matching

import (
	"abrg/internal/char"
	"abrg/internal/transform"
)

// extractFirstNumber extracts the first number from a string.
// Tries Arabic digits first, then kanji numbers using transform.KanjiToArabic.
// Examples:
//
//	"1-23-1" -> "1"
//	"二丁目" -> "2"
//	"百二十三号" -> "123"
//	"三五十" -> "3510" (irregular place name)
//	"虎ノ門1-23-1" -> "1"
//	"丁目" -> ""
func extractFirstNumber(s string) string {
	if s == "" {
		return ""
	}

	// Step 1: Try to find Arabic digits first
	if run := leadingDigitRun(s); run != "" {
		return run
	}

	// Step 2: Try kanji conversion using transform.KanjiToArabic
	// This handles both regular compound numbers (十二->12, 三十五->35)
	// and irregular place name patterns (三五十->3510).
	converted, changed := transform.KanjiToArabic(s)
	if !changed {
		return ""
	}

	// Step 3: Extract leading Arabic digit sequence from converted string
	return leadingDigitRun(converted)
}

// leadingDigitRun returns the first run of consecutive ASCII digits in s,
// or "" if s contains none.
func leadingDigitRun(s string) string {
	start := -1
	for i, r := range s {
		if char.IsASCIIDigit(r) {
			if start == -1 {
				start = i
			}
		} else if start != -1 {
			return s[start:i]
		}
	}
	if start != -1 {
		return s[start:]
	}
	return ""
}
