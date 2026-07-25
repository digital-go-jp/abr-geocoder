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
	// The exception is a pure same-length substitution in the town name
	// (e.g. 紀●井町 → 紀尾井町): there the number section is byte-identical to an
	// exact match, so it is safe to resolve. See fuzzyMatchAllowsTwoStage / #246.
	newState, usedLevenshteinFallback, err := n.tryLevenshteinFallback(ctx, nctx)
	if err != nil {
		return nil, err
	}
	nctx.State = newState

	if !usedLevenshteinFallback || n.fuzzyMatchAllowsTwoStage(nctx) {
		switch nctx.Input.AddressType {
		case model.NormalizeCategoryResidential:
			results, err = n.tryTwoStageResidential(ctx, nctx)
			if err != nil {
				return nil, err
			}

		case model.NormalizeCategoryParcel:
			results, err = n.tryTwoStageParcel(ctx, nctx)
			if err != nil {
				return nil, err
			}

		case model.NormalizeCategoryUndetermined, model.NormalizeCategoryUnknown:
			results, err = n.tryTwoStageResidential(ctx, nctx)
			if err != nil {
				return nil, err
			}

			// Try parcel only if no complete residential match
			hasCompleteResidentialMatch := len(results) > 0 &&
				results[0].Score == 1.0 &&
				results[0].MatchLevel == model.MatchLevelResidentialDetail
			if !hasCompleteResidentialMatch {
				parcelResults, parcelErr := n.tryTwoStageParcel(ctx, nctx)
				if parcelErr != nil {
					return nil, parcelErr
				}
				results = append(results, parcelResults...)
			}
		}

		// A detail resolved from a fuzzy (sub-1.0) town match must not outrank an
		// exact match, so inherit the fuzzy town score onto it.
		if usedLevenshteinFallback && len(nctx.State.BasicResults) > 0 {
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

// tryLevenshteinFallback attempts Levenshtein search when no BasicResults exist.
// Returns the updated state, true if Levenshtein fallback was used
// (meaning detailed search should be skipped), and any error.
// The caller is responsible for applying the returned state.
func (n *Impl) tryLevenshteinFallback(ctx context.Context, nctx *normalizeContext) (normalizeState, bool, error) {
	state := nctx.State

	if len(state.BasicResults) > 0 || n.repo == nil {
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
	state.LevenshteinAttempted = true
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
	return state, true, nil
}

// sortAndLimitResults sorts results by score (descending) and match level, then limits to n.
func sortAndLimitResults(results []model.MatchedResult, limit int) []model.MatchedResult {
	if len(results) == 0 {
		return results
	}

	slices.SortFunc(results, func(a, b model.MatchedResult) int {
		// Compare scores with tolerance
		scoreDiff := a.Score - b.Score
		if scoreDiff > scoreEpsilon {
			return -1 // a comes before b (descending order)
		}
		if scoreDiff < -scoreEpsilon {
			return 1 // b comes before a
		}

		// Scores are equal or very close, compare by match level detail
		return cmp.Compare(matchlevel.Detail(b.MatchLevel), matchlevel.Detail(a.MatchLevel))
	})

	if len(results) > limit {
		results = results[:limit]
	}
	return results
}

// buildLevenshteinParams constructs SearchParams from the normalize context.
func (n *Impl) buildLevenshteinParams(nctx *normalizeContext, lgCode, machiazaID string) levenshtein.SearchParams {
	return levenshtein.SearchParams{
		Category:         model.CategoryBasic,
		StandardizedAddr: nctx.Input.StandardizedAddr,
		SearchAddr:       nctx.Input.SearchAddr.String(),
		Pref:             nctx.Input.Pref,
		LgCode:           lgCode,
		MachiazaID:       machiazaID,
		NormalizedAddr:   nctx.Input.NormalizedAddr,
		Limit:            nctx.Input.Limit,
		CityBoundary:     n.cityBoundary,
	}
}
