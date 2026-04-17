package normalize

import (
	"regexp"
	"strings"
)

var dashReplacer = strings.NewReplacer(
	"‐", "-", // U+2010 HYPHEN
	"‑", "-", // U+2011 NON-BREAKING HYPHEN
	"‒", "-", // U+2012 FIGURE DASH
	"–", "-", // U+2013 EN DASH
	"—", "-", // U+2014 EM DASH
	"―", "-", // U+2015 HORIZONTAL BAR
	"−", "-", // U+2212 MINUS SIGN
	"─", "-", // U+2500 BOX DRAWINGS LIGHT HORIZONTAL
	"━", "-", // U+2501 BOX DRAWINGS HEAVY HORIZONTAL
	"➖", "-", // U+2796 HEAVY MINUS SIGN
	"﹣", "-", // U+FE63 SMALL HYPHEN-MINUS
	"－", "-", // U+FF0D FULLWIDTH HYPHEN-MINUS
	"⁻", "-", // U+207B SUPERSCRIPT MINUS
	"₋", "-", // U+208B SUBSCRIPT MINUS
	"⁃", "-", // U+2043 HYPHEN BULLET
	"〜", "-", // U+301C WAVE DASH
	"〰", "-", // U+3030 WAVY DASH
)

var katakanaDash = regexp.MustCompile(`([\d０-９])ー([\d０-９])`)
var halfwidthKatakanaDash = regexp.MustCompile(`([\d０-９])ｰ([\d０-９])`)

// NormalizeDashes converts various dash characters to standard hyphen-minus.
func NormalizeDashes(s string) (string, bool) {
	original := s

	// Fast check: if string is ASCII-only, likely no special dashes
	isASCII := true
	hasKatakanaDash := false
	hasHalfwidthKatakanaDash := false
	for i := 0; i < len(s); i++ {
		if s[i] >= 0x80 {
			isASCII = false
			// Check for katakana prolonged sound mark (ー is U+30FC, UTF-8: E3 83 BC)
			if i+2 < len(s) && s[i] == 0xE3 && s[i+1] == 0x83 && s[i+2] == 0xBC {
				hasKatakanaDash = true
			}
			// Check for halfwidth katakana prolonged sound mark (ｰ is U+FF70, UTF-8: EF BD B0)
			if i+2 < len(s) && s[i] == 0xEF && s[i+1] == 0xBD && s[i+2] == 0xB0 {
				hasHalfwidthKatakanaDash = true
			}
		}
	}

	if isASCII {
		return s, false
	}

	// Use pre-compiled replacer for all dash variants (single pass)
	s = dashReplacer.Replace(s)

	// Handle katakana prolonged sound marks between numbers (e.g., 1ー2 → 1-2).
	// Need to apply repeatedly for cases like 1ー2ー3.
	if hasKatakanaDash && strings.Contains(s, "ー") {
		s = replaceUntilStable(s, katakanaDash)
	}
	if hasHalfwidthKatakanaDash && strings.Contains(s, "ｰ") {
		s = replaceUntilStable(s, halfwidthKatakanaDash)
	}

	return s, s != original
}

// replaceUntilStable applies regex replacement repeatedly until no more changes occur.
func replaceUntilStable(s string, re *regexp.Regexp) string {
	for {
		next := re.ReplaceAllString(s, "$1-$2")
		if next == s {
			return s
		}
		s = next
	}
}
