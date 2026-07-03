package transform

import (
	"abrg/internal/normalize"
	"abrg/internal/util"
)

// Pre-built pipelines for each fixed option set.
// These are safe as package-level vars because the steps are pure functions with no mutable state.
var (
	// basicNormalizedSteps is used for text already processed by BasicNormalize.
	// Skips NFKC, NormalizeDashes, and StandardizeSpecialChars since they were already applied.
	basicNormalizedSteps = buildSteps(textOption{
		addColon:                    true,
		expandJouAndKanjiNo:         true,
		skipStandardizeSpecialChars: true,
		skipBasicNormalize:          true,
	})

	// dbSteps is used for database records (oaza_cho, koaza, etc.).
	// Skips AddColon since DB records are place names only.
	dbSteps = buildSteps(textOption{
		addColon: false,
	})
)

// textOption controls which transformations are applied during text processing.
type textOption struct {
	addColon                    bool
	expandJouAndKanjiNo         bool // ExpandSapporoJou + kanjiNoToHyphen
	skipStandardizeSpecialChars bool
	skipBasicNormalize          bool
}

// buildSteps constructs a []TransformStep from the given options.
func buildSteps(opts textOption) []normalize.TransformStep {
	var steps []normalize.TransformStep

	if !opts.skipStandardizeSpecialChars {
		steps = append(steps, StandardizeSpecialChars)
	}

	if !opts.skipBasicNormalize {
		steps = append(steps, normalize.NFKCNormalize, normalize.NormalizeDashes)
	}

	steps = append(steps, util.RemoveOazaAza)

	if opts.expandJouAndKanjiNo {
		steps = append(steps, kanjiNoToHyphen)
	}
	steps = append(steps, hiraganaToKatakana)

	if opts.addColon {
		steps = append(steps, AddColon)
	}

	steps = append(steps, KanjiToArabic)

	// ExpandSapporoJou must run after KanjiToArabic because its regex
	// matches Arabic digits only (e.g. 北3西1), so kanji input like
	// 北三西一 needs to be converted to 北3西1 first.
	if opts.expandJouAndKanjiNo {
		steps = append(steps, ExpandSapporoJou)
	}

	steps = append(steps,
		normalize.Adapt(ChomeToSymbol),
		normalize.NormalizeSpaces,
	)

	return steps
}

// TextForBasicNormalized transforms text that was already processed by BasicNormalize.
// Skips NFKC, NormalizeDashes, and StandardizeSpecialChars since they were already applied.
func TextForBasicNormalized(s string) (string, bool) {
	if s == "" {
		return s, false
	}
	return normalize.ApplySteps(s, basicNormalizedSteps)
}

// textForDB transforms database records (oaza_cho, koaza, etc.).
// Skips AddColon and AddressNumbersToHyphen since DB records are place names only.
func textForDB(s string) (string, bool) {
	if s == "" {
		return s, false
	}
	return normalize.ApplySteps(s, dbSteps)
}
