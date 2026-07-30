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

// NormalizeDashes converts various dash characters to standard hyphen-minus.
// The halfwidth katakana prolonged sound mark ｰ (U+FF70) is not handled here; it is
// normalized to ー (U+30FC) by NFKC earlier in the pipeline.
//
// NOTE: levenshtein.NormalizeUnmatchedNumbers has its own, intentionally
// smaller dash set for post-processing unmatched remainders (it converts ー
// unconditionally, which would corrupt katakana words in raw input here).
func NormalizeDashes(s string) (string, bool) {
	original := s

	// Single scan for what the two conversions below need. Every character
	// dashReplacer knows starts with E2 or EF, or with E3 80; the katakana
	// prolonged sound mark ー (U+30FC) is E3 83 BC.
	isASCII := true
	hasDashVariant := false
	hasKatakanaDash := false
	for i := 0; i < len(s); i++ {
		if s[i] < 0x80 {
			continue
		}
		isASCII = false
		switch {
		case s[i] == 0xE2 || s[i] == 0xEF:
			hasDashVariant = true
		case s[i] == 0xE3 && i+1 < len(s) && s[i+1] == 0x80:
			hasDashVariant = true
		case s[i] == 0xE3 && i+2 < len(s) && s[i+1] == 0x83 && s[i+2] == 0xBC:
			hasKatakanaDash = true
		}
	}

	if isASCII {
		return s, false
	}

	// Use pre-compiled replacer for all dash variants (single pass)
	if hasDashVariant {
		s = dashReplacer.Replace(s)
	}

	// Handle katakana prolonged sound marks between numbers (e.g., 1ー2 → 1-2).
	// Need to apply repeatedly for cases like 1ー2ー3.
	if hasKatakanaDash && strings.Contains(s, "ー") {
		s = replaceUntilStable(s, katakanaDash)
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
