package matching

import (
	"context"
	"strings"

	"abrg/internal/matching/levenshtein"
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
	addressPart, buildingParts := util.SplitStandardizedAddress(normalizedAddr)

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

// cityRecord holds scanned fields from a cache_city query row.
type cityRecord struct {
	lgCode string
	pref   string
	county *string
	city   string
	ward   *string
}

// buildResult constructs a city-level MatchedResult from the scanned record.
func (r *cityRecord) buildResult(searchAddr, normalizedAddr string, cityEnd int) *model.MatchedResult {
	// Build matched address (pref + county + city + ward)
	matchedAddr := r.pref
	if r.county != nil && *r.county != "" {
		matchedAddr += *r.county
	}
	matchedAddr += r.city
	if r.ward != nil && *r.ward != "" {
		matchedAddr += *r.ward
	}

	// Build structured address
	sa := model.StructuredAddress{Pref: &r.pref, County: r.county, City: &r.city, Ward: r.ward}

	unmatchedParts := extractCityUnmatched(matchedAddr, r.pref, searchAddr, normalizedAddr, cityEnd)

	return &model.MatchedResult{
		MatchedAddress:   matchedAddr,
		UnmatchedAddress: unmatchedParts,
		MatchLevel:       model.MatchLevelCity,
		Score:            0.3,
		IDs: model.IDs{
			LgCode: &r.lgCode,
		},
		StructuredAddress: sa,
	}
}

// extractCityUnmatched extracts unmatched address parts for city-level results.
func extractCityUnmatched(matchedAddr, pref, searchAddr, normalizedAddr string, cityEnd int) []string {
	addressPart, buildingParts := util.SplitStandardizedAddress(normalizedAddr)

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

// cityResultToRecord converts a repository.CityResult to the local cityRecord type.
func cityResultToRecord(cr *repository.CityResult) cityRecord {
	return cityRecord{
		lgCode: cr.LgCode,
		pref:   cr.Pref,
		county: cr.County,
		city:   cr.City,
		ward:   cr.Ward,
	}
}

// queryCityRecord queries cache_city for a city-level match.
func (n *Impl) queryCityRecord(ctx context.Context, searchAddr, prefCode, normalizedAddr string) (*model.MatchedResult, error) {
	cityEnd := util.FindCityBoundary(searchAddr)
	if cityEnd <= 0 {
		return nil, nil
	}

	cityPart := searchAddr[:cityEnd]

	cr, err := n.repo.FindCityRecord(ctx, repository.CityRecordParams{
		CityPart: cityPart,
		PrefCode: prefCode,
	})
	if err != nil {
		return nil, err
	}
	if cr == nil {
		return nil, nil
	}

	rec := cityResultToRecord(cr)
	return rec.buildResult(searchAddr, normalizedAddr, cityEnd), nil
}

// queryCityRecordFuzzy searches cache_city using editdist3 for fuzzy matching.
func (n *Impl) queryCityRecordFuzzy(ctx context.Context, searchAddr, prefCode, normalizedAddr string) (*model.MatchedResult, error) {
	if prefCode == "" || prefCode == model.All {
		return nil, nil
	}

	cityEnd := util.FindCityBoundary(searchAddr)
	if cityEnd <= 0 {
		return nil, nil
	}

	cityPart := searchAddr[:cityEnd]
	maxEditDist := util.MaxEditDistance(len(cityPart))

	cr, err := n.repo.FindCityRecordFuzzy(ctx, repository.CityFuzzyParams{
		CityPart:        cityPart,
		PrefCode:        prefCode,
		MaxEditDistance: maxEditDist,
	})
	if err != nil {
		return nil, err
	}
	if cr == nil {
		return nil, nil
	}

	rec := cityResultToRecord(cr)
	return rec.buildResult(searchAddr, normalizedAddr, cityEnd), nil
}
