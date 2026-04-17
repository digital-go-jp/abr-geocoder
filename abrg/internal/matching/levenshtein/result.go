// Package levenshtein provides fuzzy address matching using Levenshtein distance.
// This file contains result processing and selection functions.
package levenshtein

import (
	"cmp"
	"slices"
	"strings"

	"abrg/internal/matchlevel"
	"abrg/internal/model"
	"abrg/internal/repository"
	"abrg/internal/util"
)

// Match priority scores for selectBySearchNumbers (higher is better).
const (
	// matchScoreOazaCho is the score when searchNumbers matches oaza_cho.
	matchScoreOazaCho = 1
	// matchScoreKoazaContains is the score when koaza contains searchNumbers.
	matchScoreKoazaContains = 2
	// matchScoreKoazaPrefix is the score when koaza starts with searchNumbers (best match).
	matchScoreKoazaPrefix = 3
)

// ExtractSearchNumbers extracts the number portion from a search address.
//
//	e.g., "港区虎ノ門:1-23-1" -> "1-23-1"
func ExtractSearchNumbers(searchAddr string) string {
	// If colon exists, everything after it is the number portion
	if _, after, found := strings.Cut(searchAddr, ":"); found {
		return after
	}

	if searchAddr == "" {
		return ""
	}

	// No colon found - try to extract trailing number pattern
	// First, strip common suffixes like "号" that may follow numbers
	addr := strings.TrimSuffix(searchAddr, "号")
	return util.ExtractTrailingAddressNumbers(addr)
}

// processResults processes query results and returns normalized results.
func processResults(candidates []repository.BasicResult, searchAddr, searchNumbers, normalizedAddr, originalAddr string, category model.Category, limit int) []model.MatchedResult {
	results := make([]model.MatchedResult, 0, limit)
	addressLen := len([]rune(searchAddr))

	for i := range candidates {
		brd := &candidates[i]
		stdAddress := brd.NormalizedAddress
		result := repository.BasicResultToPartialNormalized(brd)

		// Skip candidates with chome mismatch
		if hasChomeMismatch(searchAddr, result.StructuredAddress.Chome) {
			continue
		}

		// For basic category: skip results with @ when search lacks @ and numbers
		if shouldSkipBasicCategory(category, searchAddr, searchNumbers, stdAddress) {
			continue
		}

		// Skip partial koaza matches where searchAddr ends with digits that match
		// only the digit prefix of a koaza (e.g., "大聖寺上木町95" vs koaza "95の").
		// The trailing digits are likely a parcel/house number, not a koaza reference.
		if isPartialKoazaMatch(searchAddr, stdAddress) {
			continue
		}

		// Skip false chome matches from kanji numeral conversion in place names.
		// e.g., "久保田一ノ山1523" → KanjiToArabic → "久保田1ノ山:1523"
		// falsely matches "久保田1@" (久保田1丁目) because the "1" came from 一 in 一ノ山.
		if isFalseChomeMatch(searchAddr, stdAddress) {
			continue
		}

		// Compute rune-based Levenshtein distance for accurate scoring.
		// DuckDB's editdist3 is byte-based and used only for DB-level filtering;
		// the actual score uses rune distance for correct Unicode handling.
		runeEditDist := runeLevenshtein(searchAddr, stdAddress)
		score := calculateEditDistanceScore(runeEditDist, addressLen)
		ml := matchlevel.DetermineMatchLevel(&result.IDs)
		result.MatchedAddress = model.FormatAddress(&result.StructuredAddress)
		unmatchedParts := extractUnmatchedAddress(searchNumbers, &result.StructuredAddress, category, searchAddr, normalizedAddr, result.MatchedAddress)

		result.UnmatchedAddress = unmatchedParts
		result.MatchLevel = ml
		result.Score = score

		results = append(results, result)
	}

	// Sort by score descending
	slices.SortFunc(results, func(a, b model.MatchedResult) int {
		return cmp.Compare(b.Score, a.Score)
	})

	// Select best variant among results with the same top score
	results = selectBestFromTiedResults(results, searchNumbers, originalAddr)

	if len(results) > limit {
		results = results[:limit]
	}

	return results
}

func shouldSkipBasicCategory(category model.Category, searchAddr, searchNumbers, stdAddress string) bool {
	if category != model.CategoryBasic {
		return false
	}
	hasSearchAtSign := strings.Contains(searchAddr, "@")
	hasSearchNumbers := searchNumbers != ""
	hasResultAtSign := strings.Contains(stdAddress, "@")

	return !hasSearchAtSign && !hasSearchNumbers && hasResultAtSign
}

// isPartialKoazaMatch returns true if stdAddress is searchAddr plus a non-digit suffix,
// and searchAddr ends with a digit. This indicates the trailing digits in searchAddr are
// a parcel/house number, not part of the koaza in stdAddress.
//
//	e.g., searchAddr="加賀市大聖寺上木町95", stdAddress="加賀市大聖寺上木町95ノ" -> true
//	e.g., searchAddr="加賀市大聖寺上木町95ノ", stdAddress="加賀市大聖寺上木町95ノ" -> false (exact match)
func isPartialKoazaMatch(searchAddr, stdAddress string) bool {
	if len(stdAddress) <= len(searchAddr) || !strings.HasPrefix(stdAddress, searchAddr) {
		return false
	}
	// searchAddr must end with a digit
	if len(searchAddr) == 0 || searchAddr[len(searchAddr)-1] < '0' || searchAddr[len(searchAddr)-1] > '9' {
		return false
	}
	// The extra suffix in stdAddress must be non-digit
	suffix := stdAddress[len(searchAddr):]
	for i := 0; i < len(suffix); i++ {
		if suffix[i] >= '0' && suffix[i] <= '9' {
			return false
		}
	}
	return true
}

// selectBestFromTiedResults selects the best result when multiple results have the same top score.
func selectBestFromTiedResults(results []model.MatchedResult, searchNumbers, originalAddr string) []model.MatchedResult {
	if len(results) <= 1 {
		return results
	}

	topScore := results[0].Score
	sameScoreResults := collectSameScoreResults(results, topScore)

	if len(sameScoreResults) <= 1 {
		return results
	}

	// First try: select by searchNumbers matching koaza
	// (e.g., searchNumbers "4" prefers koaza "4号" over "1号")
	if searchNumbers != "" {
		if selected := selectBySearchNumbers(sameScoreResults, searchNumbers); selected != nil {
			return append([]model.MatchedResult{*selected}, results[len(sameScoreResults):]...)
		}
	} else if originalAddr != "" {
		// Fallback: use jaccard similarity with originalAddr
		// This handles cases where multiple records have same normalized_address but different oaza_cho/koaza
		// (e.g., "大一本松" vs "大1本松", "八の坪" vs "8の坪")
		selected := SelectBestByJaccard(sameScoreResults, originalAddr)
		return append(selected, results[len(sameScoreResults):]...)
	}

	return results
}

func collectSameScoreResults(results []model.MatchedResult, topScore float64) []model.MatchedResult {
	n := 1
	for n < len(results) && results[n].Score == topScore {
		n++
	}
	return results[:n]
}

// selectBySearchNumbers selects the result whose oaza_cho or koaza best matches searchNumbers.
func selectBySearchNumbers(results []model.MatchedResult, searchNumbers string) *model.MatchedResult {
	if searchNumbers == "" || len(results) == 0 {
		return nil
	}

	var best *model.MatchedResult
	bestScore := -1

	for i := range results {
		score := 0

		// Check oaza_cho (e.g., "北11条西" for searchNumbers "11")
		if oaza := results[i].StructuredAddress.OazaCho; oaza != nil {
			if strings.Contains(*oaza, searchNumbers) {
				score = matchScoreOazaCho
			}
		}

		// Check koaza (e.g., "4号" for searchNumbers "4")
		if koaza := results[i].StructuredAddress.Koaza; koaza != nil {
			if strings.Contains(*koaza, searchNumbers) {
				// Prefer exact prefix match
				if strings.HasPrefix(*koaza, searchNumbers) {
					score = matchScoreKoazaPrefix
				} else if score < matchScoreKoazaContains {
					score = matchScoreKoazaContains
				}
			}
		}

		if score > bestScore {
			bestScore = score
			best = &results[i]
		}
	}

	return best
}

// isFalseChomeMatch returns true if stdAddress has a chome marker (@) but
// searchAddr's base part extends beyond the oaza with non-digit characters,
// indicating a sub-locality place name (e.g., 一ノ山) that contains a digit
// from kanji numeral conversion.
//
//	e.g., searchAddr="久保田1ノ山:1523", stdAddress="久保田1@" → true (一ノ山 is a place name)
//	e.g., searchAddr="久保田1:23",       stdAddress="久保田1@" → false (1 is a real chome number)
func isFalseChomeMatch(searchAddr, stdAddress string) bool {
	if !strings.Contains(stdAddress, "@") || strings.Contains(searchAddr, "@") {
		return false
	}

	// Extract oaza part from stdAddress: everything before digit+@
	atIdx := strings.Index(stdAddress, "@")
	if atIdx <= 0 {
		return false
	}
	oazaEnd := atIdx
	for oazaEnd > 0 && stdAddress[oazaEnd-1] >= '0' && stdAddress[oazaEnd-1] <= '9' {
		oazaEnd--
	}
	if oazaEnd == atIdx {
		return false // No digit before @
	}
	oaza := stdAddress[:oazaEnd]

	// Extract base of searchAddr (before colon)
	searchBase, _, _ := strings.Cut(searchAddr, ":")

	// Check if searchAddr base extends beyond the oaza
	if !strings.HasPrefix(searchBase, oaza) {
		return false
	}
	extra := searchBase[len(oaza):]
	if extra == "" {
		return false // Exact match, no extra chars
	}

	// If extra contains only digits, it could be a real chome number
	for i := range len(extra) {
		if extra[i] < '0' || extra[i] > '9' {
			return true // Non-digit in extra → place name, not chome
		}
	}
	return false
}
