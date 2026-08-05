// Package levenshtein provides fuzzy address matching using Levenshtein distance.
// This file contains the main Levenshtein search functions and fallback strategies.
package levenshtein

import (
	"context"
	"fmt"
	"strings"
	"unicode/utf8"

	"abrg/internal/matchlevel"
	"abrg/internal/model"
	"abrg/internal/repository"
	"abrg/internal/util"
)

// levenshteinQuerier is a consumer-defined interface for fuzzy address matching.
type levenshteinQuerier interface {
	FindBasicByLevenshtein(ctx context.Context, params repository.LevenshteinParams) ([]repository.BasicResult, error)
	FindBasicByPrefix(ctx context.Context, params repository.PrefixParams) ([]repository.BasicResult, error)
	FindCityByAddress(ctx context.Context, params repository.CitySearchParams) (*repository.CityResult, error)
	FindCandidateLgCodes(ctx context.Context, params repository.CityFuzzyParams) ([]string, error)
}

// Search performs fuzzy address matching using Levenshtein distance.
// It includes fallback strategies for low-score matches and prefix matching.
func Search(ctx context.Context, repo levenshteinQuerier, p SearchParams) ([]model.MatchedResult, error) {
	results, err := searchCore(ctx, repo, p)
	if err != nil {
		return nil, err
	}

	// Fallback 1: If town name mismatch detected, try prefix matching, then a
	// city-level match.
	// This prevents false matches like 烏ケ辻町 -> 石ケ辻町 while allowing valid fuzzy matches.
	// We check all results regardless of score because high-score matches can still have
	// town name mismatches (e.g., 札内松町 -> 札内東町 at score 0.75).
	if len(results) > 0 && hasTownNameMismatch(p.CityBoundary, p.SearchAddr, &results[0]) {
		// The input town may still be in the DB under a shorter name, with the
		// extra part (a chome the town does not have, an unregistered koaza)
		// pushing the edit distance past the closest wrong town. Prefix matching
		// finds it, and a town it agrees with beats falling back to the city.
		prefixResults, prefixErr := searchWithPrefixMatch(ctx, repo, p)
		if prefixErr != nil {
			return nil, prefixErr
		}
		// A row without an oaza_cho is the municipality's own machiaza row, a
		// city-level answer wearing a machiaza label, so it is no improvement.
		if len(prefixResults) > 0 && prefixResults[0].StructuredAddress.OazaCho != nil &&
			!hasTownNameMismatch(p.CityBoundary, p.SearchAddr, &prefixResults[0]) {
			return prefixResults, nil
		}

		cityResults, cityErr := tryFallbackCitySearchByScore(ctx, repo, p)
		if cityErr != nil {
			return nil, cityErr
		}
		if len(cityResults) > 0 {
			return cityResults, nil
		}
		// Discard the wrong town-level match rather than returning it.
		// When the town name clearly differs (e.g., 港町 vs 旭町), returning the
		// wrong match is worse than returning no result at all.
		return nil, nil
	}

	// Fallback 2: If no results found, try prefix matching for addresses with unknown koaza
	// This handles cases like "宇佐市安心院町古川長坂" where DB has "宇佐市安心院町古川"
	// and the extra "長坂" (koaza not in DB) exceeds the Levenshtein threshold
	if len(results) == 0 {
		prefixResults, prefixErr := searchWithPrefixMatch(ctx, repo, p)
		if prefixErr != nil {
			return nil, prefixErr
		}
		if len(prefixResults) > 0 {
			return prefixResults, nil
		}
	}

	return results, nil
}

func searchCore(ctx context.Context, repo levenshteinQuerier, p SearchParams) ([]model.MatchedResult, error) {
	// Early check for context cancellation
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	// Only basic category is supported for Levenshtein search
	if p.Category != model.CategoryBasic {
		return nil, fmt.Errorf("unsupported category for Levenshtein search: %s", p.Category)
	}

	// Every machiaza query needs a region filter: without one editdist3 runs
	// over every machiaza in the country, seconds of CPU for a guess spanning
	// all of Japan. An address carrying no code is scoped by the cities its
	// city name is closest to, and one naming no city at all is not searched.
	var lgCodes []string
	if !p.hasRegionAnchor() {
		var err error
		if lgCodes, err = candidateLgCodes(ctx, repo, p); err != nil || len(lgCodes) == 0 {
			return nil, err
		}
	}

	searchNumbers := ExtractSearchNumbers(p.SearchAddr)

	queryCtx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	rows, err := repo.FindBasicByLevenshtein(queryCtx, repository.LevenshteinParams{
		SearchAddr: p.SearchAddr,
		PrefCode:   p.Pref,
		LgCode:     p.LgCode,
		MachiazaID: p.MachiazaID,
		LgCodes:    lgCodes,
		Limit:      p.Limit,
	})
	if err != nil {
		if queryCtx.Err() == context.DeadlineExceeded {
			return nil, fmt.Errorf("query timeout exceeded (%v): %w", queryTimeout, err)
		}
		return nil, fmt.Errorf("database query failed: %w", err)
	}

	return processResults(rows, p.SearchAddr, searchNumbers, p.NormalizedAddr, p.Category, p.Limit), nil
}

// candidateLgCodes resolves the city name in the address to the codes of the
// cities closest to it. The lookup runs over cache_city, one row per city and
// ward, so an address that resolves to nothing costs one cheap query.
func candidateLgCodes(ctx context.Context, repo levenshteinQuerier, p SearchParams) ([]string, error) {
	cityPart := p.cityPart()
	if cityPart == "" {
		return nil, nil
	}

	queryCtx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	return repo.FindCandidateLgCodes(queryCtx, repository.CityFuzzyParams{
		CityPart:        cityPart,
		PrefCode:        p.Pref,
		MaxEditDistance: util.MaxEditDistance(len(cityPart)),
	})
}

// searchWithPrefixMatch searches for addresses where the DB's normalized_address is a prefix of searchAddr.
//
//	e.g., searchAddr="宇佐市安心院町古川長坂" matches DB record "宇佐市安心院町古川"
func searchWithPrefixMatch(ctx context.Context, repo levenshteinQuerier, p SearchParams) ([]model.MatchedResult, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	// Extract base address (before colon or @) for prefix matching
	baseAddr := p.SearchAddr
	if before, _, found := strings.Cut(p.SearchAddr, ":"); found {
		baseAddr = before
	}
	if before, _, found := strings.Cut(baseAddr, "@"); found {
		baseAddr = before
	}

	// Skip if base address is too short (need at least city + some characters)
	baseLen := utf8.RuneCountInString(baseAddr)
	if baseLen < minPrefixMatchLength {
		return nil, nil
	}

	queryCtx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	candidates, err := repo.FindBasicByPrefix(queryCtx, repository.PrefixParams{
		BaseAddr: baseAddr,
		PrefCode: p.Pref,
		Limit:    p.Limit,
	})
	if err != nil {
		return nil, fmt.Errorf("prefix match query failed: %w", err)
	}

	results := make([]model.MatchedResult, 0, p.Limit)
	for i := range candidates {
		brd := &candidates[i]
		result := repository.BasicResultToPartialNormalized(brd)

		matchedAddr := model.FormatAddress(&result.StructuredAddress)
		ml := matchlevel.DetermineMatchLevel(&result.IDs)

		// Calculate unmatched part from normalizedAddr (preserves user-visible form)
		unmatchedParts := extractUnmatchedSegments(p.NormalizedAddr, matchedAddr)

		// Calculate score based on how much of the input matched
		matchedLen := utf8.RuneCountInString(brd.NormalizedAddress)

		result.MatchedAddress = matchedAddr
		result.UnmatchedAddress = unmatchedParts
		result.MatchLevel = ml
		result.Score = float64(matchedLen) / float64(baseLen)

		results = append(results, result)
	}

	return results, nil
}

// tryFallbackCitySearchByScore attempts city-level search when Levenshtein match has a town name mismatch.
// It queries cache_city directly instead of cache_machiaza, because searching a city-level address
// (e.g., "福山市") against cache_machiaza entries (e.g., "福山市旭町") produces excessive edit distances.
// standardizedRemainder returns the portion of the standardized address after the
// matched city. It strips the matched "pref+county+city+ward" prefix (with or
// without the leading prefecture, since the standardized form may omit it),
// falling back to the city-boundary slice when neither prefix matches. This keeps
// the unmatched remainder intact when the boundary heuristic would over-extend
// into a non-ward 区 (e.g. 奥州市胆沢区, where 胆沢区 is part of an oaza, not a ward).
func standardizedRemainder(standardized, matchedAddr, pref string, boundary *util.CityBoundary) string {
	if rest, ok := strings.CutPrefix(standardized, matchedAddr); ok {
		return rest
	}
	if rest, ok := strings.CutPrefix(standardized, strings.TrimPrefix(matchedAddr, pref)); ok {
		return rest
	}
	return standardized[boundary.Find(standardized):]
}

// NOTE: matching.buildCityResult builds a similar city-level result but is
// intentionally a separate implementation: it normalizes the unmatched
// remainder with NormalizeUnmatchedNumbers and its source row never carries
// coordinates, whereas this fallback keeps the remainder verbatim and
// propagates the row's coordinates.
func tryFallbackCitySearchByScore(ctx context.Context, repo levenshteinQuerier, p SearchParams) ([]model.MatchedResult, error) {
	cityEndIdx := p.CityBoundary.Find(p.SearchAddr)
	if cityEndIdx <= 0 {
		return nil, nil
	}

	cityLevelAddr := p.SearchAddr[:cityEndIdx]

	queryCtx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	cr, err := repo.FindCityByAddress(queryCtx, repository.CitySearchParams{
		CityAddr: cityLevelAddr,
		LgCode:   p.LgCode,
		PrefCode: p.Pref,
	})
	if err != nil {
		return nil, fmt.Errorf("city fallback query: %w", err)
	}
	if cr == nil {
		return nil, nil
	}

	sa := model.StructuredAddress{
		Pref: &cr.Pref, County: cr.County, City: &cr.City, Ward: cr.Ward,
	}

	matchedAddr := model.FormatAddress(&sa)
	unmatchedStdPart := standardizedRemainder(p.NormalizedAddr, matchedAddr, cr.Pref, p.CityBoundary)
	unmatchedParts := strings.Fields(unmatchedStdPart)
	if len(unmatchedParts) == 0 {
		unmatchedParts = nil // fully matched must be nil (JSON null), not []
	}

	var coords []float64
	if cr.Lon != nil && cr.Lat != nil {
		coords = []float64{*cr.Lon, *cr.Lat}
	}

	result := model.MatchedResult{
		MatchedAddress:   matchedAddr,
		UnmatchedAddress: unmatchedParts,
		MatchLevel:       model.MatchLevelCity,
		Score:            0.3,
		IDs: model.IDs{
			LgCode: &cr.LgCode,
		},
		StructuredAddress: sa,
		Coordinates:       coords,
	}

	return []model.MatchedResult{result}, nil
}
