package matching

import (
	"context"
	"strings"

	"abrg/internal/matching/levenshtein"
	"abrg/internal/matching/unmatched"
	"abrg/internal/model"
	"abrg/internal/repository"
	"abrg/internal/util"
)

// queryPrefectureRecord queries DB for prefecture record by pref_code.
func (n *Impl) queryPrefectureRecord(ctx context.Context, prefCode, normalizedAddr string) (*model.MatchedResult, error) {
	pr, err := n.repo.FindPrefecture(ctx, prefCode)
	if err != nil {
		return nil, err
	}
	if pr == nil {
		return nil, nil
	}

	// Build unmatched address parts
	addressPart, buildingParts := unmatched.SplitStandardizedAddress(normalizedAddr)

	unmatchedAddr, _ := strings.CutPrefix(addressPart, pr.PrefName)

	var unmatchedParts []string
	if unmatchedAddr != "" {
		unmatchedParts = append(unmatchedParts, unmatchedAddr)
	}
	unmatchedParts = append(unmatchedParts, buildingParts...)

	return &model.MatchedResult{
		MatchedAddress:   pr.PrefName,
		UnmatchedAddress: unmatchedParts,
		MatchLevel:       model.MatchLevelPrefecture,
		Score:            0.1,
		IDs: model.IDs{
			LgCode: &pr.LgCode,
		},
		StructuredAddress: model.StructuredAddress{
			Pref: &pr.PrefName,
		},
	}, nil
}

// buildCityResult constructs a city-level MatchedResult from a cache_city query row.
//
// NOTE: levenshtein.tryFallbackCitySearchByScore builds a similar city-level
// result but is intentionally a separate implementation: it carries the row's
// coordinates and returns the unmatched remainder verbatim (no 番地/width
// normalization), whereas this builder normalizes the remainder with
// NormalizeUnmatchedNumbers and never has coordinates in its source row.
func buildCityResult(cr *repository.CityResult, searchAddr, normalizedAddr string, cityEnd int) *model.MatchedResult {
	sa := model.StructuredAddress{Pref: &cr.Pref, County: cr.County, City: &cr.City, Ward: cr.Ward}
	matchedAddr := model.FormatAddress(&sa)

	unmatchedParts := extractCityUnmatched(matchedAddr, cr.Pref, searchAddr, normalizedAddr, cityEnd)

	return &model.MatchedResult{
		MatchedAddress:   matchedAddr,
		UnmatchedAddress: unmatchedParts,
		MatchLevel:       model.MatchLevelCity,
		Score:            0.3,
		IDs: model.IDs{
			LgCode: &cr.LgCode,
		},
		StructuredAddress: sa,
	}
}

// extractCityUnmatched extracts unmatched address parts for city-level results.
func extractCityUnmatched(matchedAddr, pref, searchAddr, normalizedAddr string, cityEnd int) []string {
	addressPart, buildingParts := unmatched.SplitStandardizedAddress(normalizedAddr)

	var unmatchedAddr string
	if after, found := strings.CutPrefix(addressPart, matchedAddr); found && after != "" {
		unmatchedAddr = after
	} else if after, found := strings.CutPrefix(addressPart, strings.TrimPrefix(matchedAddr, pref)); found && after != "" {
		// Try without pref prefix (for no-pref input like "大阪市天王寺区...")
		// matchedAddr = "大阪府大阪市天王寺区", pref = "大阪府"
		unmatchedAddr = after
	} else if cityEnd < len(searchAddr) {
		// Fallback: use the remaining searchAddr after city
		// Remove colon separator if present (e.g., "東:16-48" → "東16-48")
		unmatchedAddr = strings.ReplaceAll(searchAddr[cityEnd:], ":", "")
	}

	var unmatchedParts []string
	if unmatchedAddr != "" {
		unmatchedParts = append(unmatchedParts, levenshtein.NormalizeUnmatchedNumbers(unmatchedAddr))
	}
	unmatchedParts = append(unmatchedParts, buildingParts...)
	return unmatchedParts
}

// cityResult turns a cache_city lookup outcome into a city-level MatchedResult,
// short-circuiting on error or no match.
func cityResult(cr *repository.CityResult, err error, searchAddr, normalizedAddr string, cityEnd int) (*model.MatchedResult, error) {
	if err != nil {
		return nil, err
	}
	if cr == nil {
		return nil, nil
	}
	return buildCityResult(cr, searchAddr, normalizedAddr, cityEnd), nil
}

// queryCityRecord queries cache_city for a city-level match.
func (n *Impl) queryCityRecord(ctx context.Context, searchAddr, prefCode, normalizedAddr string) (*model.MatchedResult, error) {
	cityEnd := n.cityBoundary.Find(searchAddr)
	if cityEnd <= 0 {
		return nil, nil
	}

	cr, err := n.repo.FindCityRecord(ctx, repository.CityRecordParams{
		CityPart: searchAddr[:cityEnd],
		PrefCode: prefCode,
	})
	return cityResult(cr, err, searchAddr, normalizedAddr, cityEnd)
}

// queryCityRecordFuzzy searches cache_city using editdist3 for fuzzy matching.
func (n *Impl) queryCityRecordFuzzy(ctx context.Context, searchAddr, prefCode, normalizedAddr string) (*model.MatchedResult, error) {
	if prefCode == "" || prefCode == model.All {
		return nil, nil
	}

	cityEnd := n.cityBoundary.Find(searchAddr)
	if cityEnd <= 0 {
		return nil, nil
	}

	cityPart := searchAddr[:cityEnd]
	cr, err := n.repo.FindCityRecordFuzzy(ctx, repository.CityFuzzyParams{
		CityPart:        cityPart,
		PrefCode:        prefCode,
		MaxEditDistance: util.MaxEditDistance(len(cityPart)),
	})
	return cityResult(cr, err, searchAddr, normalizedAddr, cityEnd)
}
