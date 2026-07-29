package matching

import "abrg/internal/model"

// normalizeInput holds immutable input data for normalization.
// These values are set once at the start and never modified during processing.
type normalizeInput struct {
	NormalizedAddr string                  // Basic-normalized input (comments removed, NFKC applied); also the user-facing form for unmatched extraction
	SearchAddr     parsedAddress           // Parsed search address (eliminates redundant parseSearchAddr calls)
	Pref           string                  // Prefecture code filter
	Limit          int                     // Max results
	Category       model.Category          // Requested category filter (all/basic/rsdtdsp/parcel)
	AddressType    model.NormalizeCategory // Category type (residential/parcel/undetermined/unknown)
}

// normalizeState holds mutable state during normalization.
// These values may be updated as processing progresses.
type normalizeState struct {
	LgCode          string                // Local government code (may be detected/updated)
	MachiazaID      string                // Machiaza ID (may be detected/updated)
	BasicResults    []model.MatchedResult // Pre-detected or Levenshtein-matched results
	UsedLevenshtein bool                  // True if BasicResults came from Levenshtein search
	// SkipLevenshtein withholds the Levenshtein search from the remaining
	// steps, either because it has already run or because the caller wants the
	// address resolved without it. The search reads far more rows than an exact
	// lookup, so leaving it out is what makes an address that misses cheap.
	SkipLevenshtein bool
}

// normalizeContext combines input and state for normalization functions.
// Input fields are immutable; State fields may be modified during processing.
type normalizeContext struct {
	Input normalizeInput
	State normalizeState
}
