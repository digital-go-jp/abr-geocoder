package transform

import (
	"regexp"
	"strings"

	"abrg/internal/char"
	"abrg/internal/normalize"
)

// Character ranges an address may end with. They are the single source for
// every regex character class in this file; isAddressEndChar tests
// addressEndChars as runes.
const (
	kanjiBlockChars  = "一-龥"
	nonDigitEndChars = "A-Zア-ン" + kanjiBlockChars
	addressEndChars  = `\d` + nonDigitEndChars
)

// Regex patterns for colon insertion between text and address numbers.
var (
	// chomeKanjiBlockPattern matches 丁目 + kanji block names (e.g., "4丁目渡辺" or "4丁目渡辺-2")
	chomeKanjiBlockPattern = regexp.MustCompile(`(丁目)([` + kanjiBlockChars + `]+(?:-[` + addressEndChars + `]+)*-?)\s*$`)

	// chomeKanjiBlockGoPattern matches 丁目 + kanji block + number + 号 (e.g., "4丁目渡辺3号")
	chomeKanjiBlockGoPattern = regexp.MustCompile(`(丁目)([` + kanjiBlockChars + `]+)(\d+)号\s*$`)

	// chomeKanjiBlockNumPattern matches 丁目 + kanji block + number without 号 (e.g., "4丁目渡辺3")
	// Excludes: 町 (town names), \d (digits), \s and \pZ (separate token; \s alone
	// misses U+3000), - (hyphen patterns handled elsewhere)
	chomeKanjiBlockNumPattern = regexp.MustCompile(`(丁目)([` + kanjiBlockChars + `]*[^町\d\s\pZ-])(\d+)\s*$`)

	// textNumberBoundaryPattern matches typical address numbers at the end.
	// Supports: numbers (123-4), alphabet (A-20), katakana (12-エ-46), kanji block + hyphen-number
	// Excludes \pZ alongside \s so an ideographic space separates the number the
	// same way an ASCII space does.
	textNumberBoundaryPattern = regexp.MustCompile(`([^\d\s\pZ-A-Zア-ン])((?:\d+|[A-Z]+|[ア-ン]+)(?:-[` + addressEndChars + `]+)*-?|(?:-\d+))\s*$`)

	// atKanjiBlockPattern matches @ + single alphabetic/kanji/katakana character
	atKanjiBlockPattern = regexp.MustCompile(`(@)([` + nonDigitEndChars + `])`)

	// atKanjiBlockGoPattern matches @ + kanji block + number + 号 (e.g., "@渡辺3号")
	atKanjiBlockGoPattern = regexp.MustCompile(`(@)([` + kanjiBlockChars + `]+)(\d+)号\s*$`)

	// atKanjiBlockNumPattern matches @ + kanji block + number without 号 (e.g., "@渡辺3")
	atKanjiBlockNumPattern = regexp.MustCompile(`(@)([` + kanjiBlockChars + `]+)(\d+)\s*$`)
)

// atRules and chomeRules insert the colon after an @ or 丁目 marker. Both are
// ordered most specific first; the first rule that changes the string wins.
var (
	atRules = []normalize.ReplaceRule{
		{Re: atKanjiBlockGoPattern, Repl: "${1}:${2}-${3}"},
		{Re: atKanjiBlockNumPattern, Repl: "${1}:${2}-${3}"},
		{Re: atKanjiBlockPattern, Repl: "${1}:${2}"},
	}

	chomeRules = []normalize.ReplaceRule{
		{Re: chomeKanjiBlockGoPattern, Repl: "${1}:${2}-${3}"},
		{Re: chomeKanjiBlockNumPattern, Repl: "${1}:${2}-${3}"},
		{Re: chomeKanjiBlockPattern, Repl: "${1}:${2}"},
	}
)

func isAddressEndChar(r rune) bool {
	return char.IsASCIIDigit(r) ||
		(r >= 'A' && r <= 'Z') ||
		(r >= 'ア' && r <= 'ン') ||
		(r >= '一' && r <= '龥')
}

// isGaikuPattern checks if the string contains a koaza 街区 pattern (数字街区).
func isGaikuPattern(s string) bool {
	if !strings.Contains(s, "街区") {
		return false
	}
	runes := []rune(s)
	for i := 0; i < len(runes)-1; i++ {
		if runes[i] == '街' && runes[i+1] == '区' && i > 0 && char.IsASCIIDigit(runes[i-1]) {
			return true
		}
	}
	return false
}

// isSapporoAbbreviation checks if the string contains an abbreviated Sapporo address pattern
// (e.g., "北3西1-7") that should not have a colon inserted.
// These patterns will later be expanded by ExpandSapporoJou (e.g., "北3条西1丁目-7").
func isSapporoAbbreviation(s string) bool {
	if !hasSapporoJouLead(s) {
		return false
	}
	return sapporoJouPattern.MatchString(s)
}

// isSingleKatakanaColon checks if the result ends with ":<single-katakana>" (likely a koaza).
func isSingleKatakanaColon(result string) bool {
	runes := []rune(result)
	if len(runes) < 2 {
		return false
	}
	last, secondLast := runes[len(runes)-1], runes[len(runes)-2]
	return secondLast == ':' && last >= 'ア' && last <= 'ン'
}

// AddColon inserts a colon separator between text and trailing address number.
// Example: "米花町492-1" -> "米花町:492-1".
func AddColon(s string) (string, bool) {
	if strings.Contains(s, ":") {
		return s, false
	}

	// Check if string ends with a valid address character
	trimmed := strings.TrimRight(s, " ")
	if len(trimmed) > 0 {
		runes := []rune(trimmed)
		if !isAddressEndChar(runes[len(runes)-1]) {
			return s, false
		}
	}

	// Skip special patterns that should not have colons inserted
	if isHokkaidoSenPattern(s) || isGaikuPattern(s) || isSapporoAbbreviation(s) {
		return s, false
	}

	// Handle @ symbol patterns (chome symbol followed by block names)
	if strings.Contains(s, "@") && !strings.Contains(s, "@:") {
		if result, ok := normalize.ApplyFirstMatch(s, atRules); ok {
			return result, true
		}
	}

	if strings.Contains(s, "丁目") {
		if result, ok := normalize.ApplyFirstMatch(s, chomeRules); ok {
			return result, true
		}
	}

	// Try standard number/alphabet/katakana pattern
	result := textNumberBoundaryPattern.ReplaceAllString(s, "${1}:${2}")
	changed := result != s
	if changed && isSingleKatakanaColon(result) {
		return s, false // Revert: likely a koaza, not an address number
	}
	return result, changed
}
