package levenshtein

import (
	"strings"

	"abrg/internal/model"
)

// SelectBestByJaccard selects the result with highest jaccard similarity to originalAddr.
// Used for selecting between variants with same normalized_address but different oaza_cho/koaza.
// (e.g., "大一本松" prefers oaza_cho "大一本松" over "大1本松",
//
//	"八の坪" prefers koaza "八の坪" over "8の坪")
func SelectBestByJaccard(results []model.MatchedResult, originalAddr string) []model.MatchedResult {
	if len(results) <= 1 {
		return results
	}

	// originalAddr is the same for every candidate, so its bigrams are built once.
	origBigrams := buildBigrams([]rune(originalAddr))

	bestIdx := 0
	bestSim := jaccardAgainst(originalAddr, origBigrams, buildMatchedAddress(&results[0]))

	for i := 1; i < len(results); i++ {
		sim := jaccardAgainst(originalAddr, origBigrams, buildMatchedAddress(&results[i]))
		if sim > bestSim {
			bestSim = sim
			bestIdx = i
		}
	}

	return []model.MatchedResult{results[bestIdx]}
}

// buildMatchedAddress constructs the matched address string from structured address.
func buildMatchedAddress(r *model.MatchedResult) string {
	sa := r.StructuredAddress
	parts := []*string{sa.Pref, sa.County, sa.City, sa.Ward, sa.KyotoSt, sa.OazaCho, sa.Chome, sa.Koaza}
	var sb strings.Builder
	for _, p := range parts {
		if p != nil {
			sb.WriteString(*p)
		}
	}
	return sb.String()
}

// jaccardSimilarity calculates bigram-based Jaccard similarity between two strings.
func jaccardSimilarity(s1, s2 string) float64 {
	return jaccardAgainst(s1, buildBigrams([]rune(s1)), s2)
}

// jaccardAgainst is jaccardSimilarity with s1's bigrams supplied by the caller,
// so comparing many candidates against one string builds them only once.
func jaccardAgainst(s1 string, bigrams1 map[string]struct{}, s2 string) float64 {
	if s1 == s2 {
		return 1.0
	}
	bigrams2 := buildBigrams([]rune(s2))
	if len(bigrams1) == 0 || len(bigrams2) == 0 {
		return 0.0
	}

	intersection := 0
	for b := range bigrams1 {
		if _, ok := bigrams2[b]; ok {
			intersection++
		}
	}
	union := len(bigrams1) + len(bigrams2) - intersection
	if union == 0 {
		return 0.0
	}
	return float64(intersection) / float64(union)
}

func buildBigrams(runes []rune) map[string]struct{} {
	if len(runes) < 2 {
		return nil
	}
	bigrams := make(map[string]struct{}, len(runes)-1)
	for i := 0; i < len(runes)-1; i++ {
		bigrams[string(runes[i:i+2])] = struct{}{}
	}
	return bigrams
}
