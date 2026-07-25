package matching

import (
	"context"
	"fmt"
	"strings"

	"abrg/internal/matching/levenshtein"
	"abrg/internal/model"
	"abrg/internal/util"
)

func (n *Impl) handleFallback(ctx context.Context, nctx *normalizeContext) ([]model.MatchedResult, error) {
	if len(nctx.State.BasicResults) > 0 {
		return n.handleBasicFallback(ctx, nctx)
	}

	// Try city-level match from cache_city before Levenshtein
	// This handles city-only addresses (e.g., "鎌ガ谷市", "柴田郡大河原町")
	if n.repo != nil {
		searchAddrStr := nctx.Input.SearchAddr.String()
		cityResult, err := n.queryCityRecord(ctx, searchAddrStr, nctx.Input.Pref, nctx.Input.StandardizedAddr)
		if err != nil {
			return nil, fmt.Errorf("city record query: %w", err)
		}
		if cityResult == nil {
			// Fuzzy city match for addresses with mask/unknown characters (e.g., "●橋市")
			cityResult, err = n.queryCityRecordFuzzy(ctx, searchAddrStr, nctx.Input.Pref, nctx.Input.StandardizedAddr)
			if err != nil {
				return nil, fmt.Errorf("fuzzy city record query: %w", err)
			}
		}
		if cityResult != nil {
			return []model.MatchedResult{*cityResult}, nil
		}
	}

	// If no basic results, try searchWithLevenshtein to find city-level match
	// This handles cases like "神田鍛冶町二丁目" where the specific chome doesn't exist
	// Skip if already attempted in tryLevenshteinFallback (avoids duplicate search in CategoryAll)
	if n.repo != nil && !nctx.State.LevenshteinAttempted {
		levenResults, err := levenshtein.Search(ctx, n.repo, n.buildLevenshteinParams(nctx, nctx.State.LgCode, nctx.State.MachiazaID))
		if err != nil {
			if ctx.Err() != nil {
				return nil, ctx.Err()
			}
			return nil, fmt.Errorf("levenshtein search: %w", err)
		}
		if len(levenResults) > 0 {
			return levenResults, nil
		}
	}

	// If still no results but we have prefecture info, search for prefecture record in DB
	if nctx.Input.Pref != "" && nctx.Input.Pref != model.All && n.repo != nil {
		prefResult, err := n.queryPrefectureRecord(ctx, nctx.Input.Pref, nctx.Input.StandardizedAddr)
		if err != nil {
			return nil, fmt.Errorf("prefecture record query: %w", err)
		}
		if prefResult != nil {
			return []model.MatchedResult{*prefResult}, nil
		}
	}

	// Last resort: return completely unmatched
	return []model.MatchedResult{util.CreateUnmatchedResult(nctx.Input.NormalizedAddr)}, nil
}

// handleBasicFallback tries to find more specific matches (chome or oaza_cho) when applicable.
func (n *Impl) handleBasicFallback(ctx context.Context, nctx *normalizeContext) ([]model.MatchedResult, error) {
	basic := &nctx.State.BasicResults[0]

	// When chome is not yet matched, try to find a more specific record
	if basic.StructuredAddress.Chome == nil {
		if basic.IDs.HasChome {
			// has_chome=true but no chome in result - try to find chome-specific record
			results, err := n.tryChomeSearch(ctx, nctx)
			if err != nil {
				return nil, err
			}
			if results != nil {
				return results, nil
			}
		} else if basic.StructuredAddress.OazaCho == nil {
			// City-level match only - try to find oaza_cho with chome pattern
			results, err := n.tryOazaChoSearch(ctx, nctx)
			if err != nil {
				return nil, err
			}
			if results != nil {
				return results, nil
			}
		}
	}

	// Numeric-only koaza (e.g., 七尾市大田町111): the number was split off as a
	// chome/parcel candidate, but those interpretations have all failed by this
	// point, so try it as part of the machiaza name. (issue #259)
	if basic.StructuredAddress.Chome == nil && basic.StructuredAddress.Koaza == nil {
		results, err := n.tryNumericKoazaSearch(ctx, nctx)
		if err != nil {
			return nil, err
		}
		if results != nil {
			return results, nil
		}
	}

	// Set unmatched address if not already computed
	// Skip if Levenshtein fallback was used (UnmatchedAddress already computed correctly)
	// Pass original searchAddr so extractUnmatchedWithColonNoAt can detect chome patterns
	// (e.g., "1-1" → detects "1丁目" in matchedAddr → returns "-1")
	if basic.UnmatchedAddress == nil && !nctx.State.UsedLevenshtein {
		setUnmatchedAddress(basic, nctx.Input.NormalizedAddr, nctx.Input.StandardizedAddr, basic.MatchedAddress, nctx.Input.SearchAddr.String())
	}
	return nctx.State.BasicResults, nil
}

// tryChomeSearch tries to find a chome-specific record when has_chome=true but no chome in result.
func (n *Impl) tryChomeSearch(ctx context.Context, nctx *normalizeContext) ([]model.MatchedResult, error) {
	chomeSearchAddr := convertColonToChome(nctx.Input.SearchAddr)
	if chomeSearchAddr.HasChome == nctx.Input.SearchAddr.HasChome {
		return nil, nil
	}

	results, _, err := detectMachiaza(ctx, n.repo, chomeSearchAddr.String(), nctx.Input.Pref, nctx.Input.NormalizedAddr)
	if err != nil {
		return nil, fmt.Errorf("chome search: %w", err)
	}
	if len(results) == 0 || results[0].StructuredAddress.Chome == nil {
		return nil, nil
	}

	setUnmatchedAddress(&results[0], nctx.Input.NormalizedAddr, nctx.Input.StandardizedAddr, results[0].MatchedAddress, nctx.Input.SearchAddr.String())
	return results, nil
}

// tryNumericKoazaSearch interprets the first number part as a numeric-only koaza
// (e.g., "7尾市大田町:111" → normalized_address "7尾市大田町111"). Numeric koaza
// records are stored without the chome marker "@", so neither the base search nor
// the chome fallback can reach them. Remaining numbers are resolved as a parcel
// under the koaza's machiaza (e.g., 大田町111-11 → 地番11).
func (n *Impl) tryNumericKoazaSearch(ctx context.Context, nctx *normalizeContext) ([]model.MatchedResult, error) {
	sa := nctx.Input.SearchAddr
	if sa.HasChome || sa.LeadingHyphen || sa.Base == "" || len(sa.Numbers) == 0 {
		return nil, nil
	}

	results, err := queryAddressResults(ctx, n.repo, sa.Base+sa.Numbers[0], nctx.Input.Pref, nctx.Input.NormalizedAddr)
	if err != nil {
		return nil, fmt.Errorf("numeric koaza search: %w", err)
	}
	if len(results) == 0 || results[0].StructuredAddress.Koaza == nil {
		return nil, nil
	}
	koaza := &results[0]

	// Consume the first number into the base; the building name is deliberately
	// excluded from the search string because setTwoStageUnmatchedAddress recovers
	// it from the normalized address (including it here would duplicate the entry).
	base := sa.Base + sa.Numbers[0]
	rest := sa.Numbers[1:]

	// Parcel resolution of the remaining numbers only when the requested category
	// includes parcel data (empty means CategoryAll, see normalizeByCategory).
	parcelAllowed := nctx.Input.Category == model.CategoryParcel ||
		nctx.Input.Category == model.CategoryAll || nctx.Input.Category == ""

	if parcelAllowed && len(rest) > 0 && n.twoStageSearch != nil {
		parcelAddr := base + ":" + strings.Join(rest, "-")
		parcelResults, err := n.twoStageSearch.normalizeWithBasic(ctx, model.CategoryParcel, results, parcelAddr)
		if err != nil {
			return nil, err
		}
		if len(parcelResults) > 0 {
			setTwoStageUnmatchedAddress(&parcelResults[0], nctx.Input.StandardizedAddr, parcelAddr)
			return parcelResults, nil
		}
	}

	// Numbers not resolved as a parcel stay unmatched (e.g. rsdtdsp category: "-11").
	if len(rest) > 0 {
		koaza.UnmatchedAddress = append(koaza.UnmatchedAddress, "-"+strings.Join(rest, "-"))
	}
	setTwoStageUnmatchedAddress(koaza, nctx.Input.StandardizedAddr, base)
	return results, nil
}

// tryOazaChoSearch tries to find an oaza_cho record for city-level matches.
func (n *Impl) tryOazaChoSearch(ctx context.Context, nctx *normalizeContext) ([]model.MatchedResult, error) {
	chomeSearchAddr := convertColonToChome(nctx.Input.SearchAddr)
	if chomeSearchAddr.HasChome == nctx.Input.SearchAddr.HasChome {
		return nil, nil
	}

	cityBasedSearchAddr := buildCityBasedSearchAddr(nctx.State.BasicResults[0].StructuredAddress, chomeSearchAddr.String())
	results, _, err := detectMachiaza(ctx, n.repo, cityBasedSearchAddr, nctx.Input.Pref, nctx.Input.NormalizedAddr)
	if err != nil {
		return nil, fmt.Errorf("oaza_cho search: %w", err)
	}
	if len(results) == 0 || results[0].StructuredAddress.OazaCho == nil {
		return nil, nil
	}

	adjustedSearchAddr := adjustSearchAddrForMatch(nctx.Input.SearchAddr, results[0].StructuredAddress.OazaCho)
	setUnmatchedAddress(&results[0], nctx.Input.NormalizedAddr, nctx.Input.StandardizedAddr, results[0].MatchedAddress, adjustedSearchAddr)
	return results, nil
}
