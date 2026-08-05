package matching

import (
	"cmp"
	"context"
	"slices"

	"abrg/internal/matching/levenshtein"
	"abrg/internal/matchlevel"
	"abrg/internal/model"
)

// scoreEpsilon is the tolerance for comparing scores (differences <= this are treated as equal).
const scoreEpsilon = 0.002

// normalizeAll tries all levels and returns the best results.
func (n *Impl) normalizeAll(ctx context.Context, nctx *normalizeContext) ([]model.MatchedResult, error) {
	var results []model.MatchedResult

	// Try Levenshtein search if no BasicResults from exact match.
	// IMPORTANT: When Levenshtein fallback is used, we skip residential/parcel search
	// because the remaining address part may be misinterpreted
	// (e.g., "2-5" in "福室字久保野:2-5" being interpreted as chome + block number).
	// The exceptions are a pure same-length substitution in the town name
	// (e.g. 紀●井町 → 紀尾井町) and a town short of the input by a parcel-number
	// prefix (e.g. 白浜町甲402): in both the number section sits where an exact
	// match would put it, so it is safe to resolve. See fuzzyMatchAllowsTwoStage.
	newState, usedLevenshteinFallback, err := n.tryLevenshteinFallback(ctx, nctx)
	if err != nil {
		return nil, err
	}
	nctx.State = newState

	// fuzzyMatchAllowsTwoStage scans the city boundary twice, so it is asked
	// only on the path whose answer it decides.
	var allowsTwoStage bool
	var parcelPrefix string
	if usedLevenshteinFallback {
		allowsTwoStage, parcelPrefix = n.fuzzyMatchAllowsTwoStage(nctx)
	}

	if !usedLevenshteinFallback || allowsTwoStage {
		// The prefix path stands or falls on the parcel search taking the prefix
		// into its number: only that search can, the answer is worth nothing
		// without it, and an answer that has it leaves no part of the input over.
		onPrefixPath := parcelPrefix != ""
		if onPrefixPath {
			results, err = n.tryTwoStageParcel(ctx, nctx)
		} else {
			results, err = n.tryDetailedSearch(ctx, nctx)
		}
		if err != nil {
			return nil, err
		}
		if onPrefixPath && !consumedParcelPrefix(results, parcelPrefix) {
			results = nil
		}

		// A detail resolved from a fuzzy (sub-1.0) town match must not outrank an
		// exact match, so inherit the fuzzy town score onto it.
		if usedLevenshteinFallback && !onPrefixPath && len(nctx.State.BasicResults) > 0 {
			capScoresToFuzzy(results, nctx.State.BasicResults[0].Score)
		}
	}

	// Fallback to basic results if no detailed match found
	if len(results) == 0 {
		var err error
		results, err = n.handleFallback(ctx, nctx)
		if err != nil {
			return nil, err
		}
	}

	return sortAndLimitResults(results, nctx.Input.Limit), nil
}

// tryDetailedSearch runs the two-stage residential/parcel searches for the
// detected address category. Undetermined and unknown inputs try residential
// first and add parcel results unless residential already produced a complete
// detail match; any other category returns no results and leaves the caller
// to fall back to basic results.
func (n *Impl) tryDetailedSearch(ctx context.Context, nctx *normalizeContext) ([]model.MatchedResult, error) {
	switch nctx.Input.AddressType {
	case model.NormalizeCategoryResidential:
		return n.tryTwoStageResidential(ctx, nctx)

	case model.NormalizeCategoryParcel:
		return n.tryTwoStageParcel(ctx, nctx)

	case model.NormalizeCategoryUndetermined, model.NormalizeCategoryUnknown:
		results, err := n.tryTwoStageResidential(ctx, nctx)
		if err != nil {
			return nil, err
		}

		// Try parcel only if no complete residential match
		hasCompleteResidentialMatch := len(results) > 0 &&
			results[0].Score == 1.0 &&
			results[0].MatchLevel == model.MatchLevelResidentialDetail
		if hasCompleteResidentialMatch {
			return results, nil
		}
		parcelResults, err := n.tryTwoStageParcel(ctx, nctx)
		if err != nil {
			return nil, err
		}
		return append(results, parcelResults...), nil
	}
	return nil, nil
}

// tryLevenshteinFallback attempts Levenshtein search when no BasicResults exist.
// Returns the updated state, true if Levenshtein fallback was used
// (meaning detailed search should be skipped), and any error.
// The caller is responsible for applying the returned state.
func (n *Impl) tryLevenshteinFallback(ctx context.Context, nctx *normalizeContext) (normalizeState, bool, error) {
	state := nctx.State

	if len(state.BasicResults) > 0 || n.repo == nil || state.SkipLevenshtein {
		return state, false, nil
	}

	// Skip Levenshtein for city-only addresses (e.g., "柴田郡大河原町")
	// These should be handled by queryCityRecord in handleFallback, not by fuzzy matching
	// which may find wrong machiaza-level matches (e.g., "柴田郡大河原町南" with oaza_cho="字南")
	searchAddrStr := nctx.Input.SearchAddr.String()
	cityEnd := n.cityBoundary.Find(searchAddrStr)
	if cityEnd > 0 && cityEnd == len(searchAddrStr) {
		return state, false, nil
	}

	// Try to detect lg_code before search for better filtering (reduces scan from ~35k to ~2k records)
	if state.LgCode == "" {
		state.LgCode = n.detectLgCode(searchAddrStr)
	}

	levenResults, err := levenshtein.Search(ctx, n.repo, n.buildLevenshteinParams(nctx, state.LgCode, state.MachiazaID))
	state.SkipLevenshtein = true
	if err != nil {
		return state, false, err
	}
	if len(levenResults) == 0 {
		return state, false, nil
	}

	// Build new state with Levenshtein results
	state.BasicResults = levenResults
	state.UsedLevenshtein = true
	state.LgCode = derefString(levenResults[0].IDs.LgCode)
	state.MachiazaID = derefString(levenResults[0].IDs.MachiazaID)
	debugMatchPath(ctx, "levenshtein", nctx.Input.NormalizedAddr,
		"results", len(levenResults), "score", levenResults[0].Score)
	return state, true, nil
}

// compareResultStrength orders results from strongest to weakest: a higher
// score first, then a more detailed match level. Score comes first because a
// fuzzy match that reaches a deeper level still matches a different address.
// Scores within scoreEpsilon count as equal.
func compareResultStrength(a, b model.MatchedResult) int {
	scoreDiff := a.Score - b.Score
	if scoreDiff > scoreEpsilon {
		return -1 // a comes before b (descending order)
	}
	if scoreDiff < -scoreEpsilon {
		return 1 // b comes before a
	}
	return cmp.Compare(matchlevel.Detail(b.MatchLevel), matchlevel.Detail(a.MatchLevel))
}

// sortAndLimitResults sorts results from strongest to weakest, then limits to n.
func sortAndLimitResults(results []model.MatchedResult, limit int) []model.MatchedResult {
	if len(results) == 0 {
		return results
	}

	slices.SortStableFunc(results, compareResultStrength)

	if len(results) > limit {
		results = results[:limit]
	}
	return results
}

// strongestResult returns the strongest result and whether there was one.
func strongestResult(results []model.MatchedResult) (model.MatchedResult, bool) {
	if len(results) == 0 {
		return model.MatchedResult{}, false
	}
	return slices.MinFunc(results, compareResultStrength), true
}

// buildLevenshteinParams constructs SearchParams from the normalize context.
func (n *Impl) buildLevenshteinParams(nctx *normalizeContext, lgCode, machiazaID string) levenshtein.SearchParams {
	return levenshtein.SearchParams{
		Category:       model.CategoryBasic,
		SearchAddr:     nctx.Input.SearchAddr.String(),
		Pref:           nctx.Input.Pref,
		LgCode:         lgCode,
		MachiazaID:     machiazaID,
		NormalizedAddr: nctx.Input.NormalizedAddr,
		Limit:          nctx.Input.Limit,
		CityBoundary:   n.cityBoundary,
	}
}
