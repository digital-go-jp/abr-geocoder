package matching

import "abrg/internal/model"

// normalizeInput holds immutable input data for normalization.
// These values are set once at the start and never modified during processing.
type normalizeInput struct {
	NormalizedAddr   string                  // Basic-normalized input (comments removed, NFKC applied)
	StandardizedAddr string                  // Lightly standardized address (for user display)
	SearchAddr       parsedAddress           // Parsed search address (eliminates redundant parseSearchAddr calls)
	Pref             string                  // Prefecture code filter
	Limit            int                     // Max results
	Category         model.Category          // Requested category filter (all/basic/rsdtdsp/parcel)
	AddressType      model.NormalizeCategory // Category type (residential/parcel/undetermined/unknown)
}

// normalizeState holds mutable state during normalization.
// These values may be updated as processing progresses.
type normalizeState struct {
	LgCode               string                // Local government code (may be detected/updated)
	MachiazaID           string                // Machiaza ID (may be detected/updated)
	BasicResults         []model.MatchedResult // Pre-detected or Levenshtein-matched results
	UsedLevenshtein      bool                  // True if BasicResults came from Levenshtein search
	LevenshteinAttempted bool                  // True if Levenshtein search was already attempted
}

// normalizeContext combines input and state for normalization functions.
// Input fields are immutable; State fields may be modified during processing.
type normalizeContext struct {
	Input normalizeInput
	State normalizeState
}

// matchLevelToDetail converts match level to a numeric detail value.
// Higher values indicate more detailed matches.
// Residential addresses (住居表示) are prioritized over parcel (地番).
func matchLevelToDetail(level model.MatchLevel) int {
	switch level {
	case model.MatchLevelResidentialDetail:
		return 7
	case model.MatchLevelResidentialBlock:
		return 6
	case model.MatchLevelParcel:
		return 5
	case model.MatchLevelMachiazaDetail:
		return 4
	case model.MatchLevelMachiaza:
		return 3
	case model.MatchLevelCity:
		return 2
	case model.MatchLevelPrefecture:
		return 1
	default:
		return 0
	}
}
