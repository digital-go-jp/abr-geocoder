package transform

import (
	"abrg/internal/normalize"
	"abrg/internal/util"
)

// The steps are pure functions with no mutable state, so the pipelines are
// safe to share as package-level vars.
var (
	// basicNormalizedSteps handles text that BasicNormalize already ran on, so
	// StandardizeSpecialChars, NFKCNormalize and NormalizeDashes are omitted.
	basicNormalizedSteps = []normalize.TransformStep{
		util.RemoveOazaAza,
		kanjiNoToHyphen,
		hiraganaToKatakana,
		AddColon,
		KanjiToArabic,
		// expandSapporoJou must run after KanjiToArabic because its regex
		// matches Arabic digits only (e.g. 北3西1), so kanji input like
		// 北三西一 needs to be converted to 北3西1 first.
		expandSapporoJou,
		ChomeToSymbol,
		normalize.NormalizeSpaces,
	}

	// dbSteps handles database records (oaza_cho, koaza, etc.). They are place
	// names with no trailing address number, so AddColon is omitted.
	dbSteps = []normalize.TransformStep{
		StandardizeSpecialChars,
		normalize.NFKCNormalize,
		normalize.NormalizeDashes,
		util.RemoveOazaAza,
		hiraganaToKatakana,
		KanjiToArabic,
		ChomeToSymbol,
		normalize.NormalizeSpaces,
	}
)

// TextForBasicNormalized transforms text that was already processed by BasicNormalize.
func TextForBasicNormalized(s string) (string, bool) {
	if s == "" {
		return s, false
	}
	return normalize.ApplySteps(s, basicNormalizedSteps)
}

// TextForDB transforms database records (oaza_cho, koaza, etc.).
func TextForDB(s string) (string, bool) {
	if s == "" {
		return s, false
	}
	return normalize.ApplySteps(s, dbSteps)
}
