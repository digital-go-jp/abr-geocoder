// Package levenshtein provides fuzzy address matching using Levenshtein distance.
// This file contains match validation functions for filtering false-positive fuzzy matches.
package levenshtein

import (
	"strings"

	"abrg/internal/model"
	"abrg/internal/transform"
	"abrg/internal/util"
)

// hasChomeMismatch checks if the search address chome doesn't match the result chome.
func hasChomeMismatch(searchAddr string, resultChome *string) bool {
	if resultChome == nil || !strings.Contains(searchAddr, "@") {
		return false
	}

	atPos := strings.Index(searchAddr, "@")
	if atPos <= 0 {
		return false
	}

	// Extract chome number from search address (trailing digits before "@")
	searchChome := util.ExtractChomeDigits(searchAddr[:atPos])
	if searchChome == "" {
		return false
	}

	// Extract number from result chome
	resultChomeNum := util.StripChomeSuffix(*resultChome)
	resultChomeNum, _ = transform.KanjiToArabic(resultChomeNum)

	return searchChome != resultChomeNum
}

// hasTownNameMismatch checks if the input town name doesn't match the result's oaza_cho.
func hasTownNameMismatch(boundary *util.CityBoundary, searchAddr string, result *model.MatchedResult) bool {
	if result == nil || result.StructuredAddress.OazaCho == nil {
		return false
	}

	// Skip check for Kyoto street addresses - the town name extraction doesn't work well
	// because the street name (e.g., 西中筋通北小路上る) comes before the actual town name.
	if result.StructuredAddress.KyotoSt != nil {
		return false
	}

	// Extract town name part from searchAddr (after city/ward boundary)
	inputTownName := extractTownNameFromSearch(boundary, searchAddr)
	if inputTownName == "" {
		// No town name extracted - check if the content after city is purely numeric.
		// Purely numeric content (e.g., "南関町73") means the digits are being wrongly
		// matched to a place name (e.g., "大字今"), so flag as mismatch.
		// Non-numeric content (e.g., "8条寺ノ内町:10" from kanji conversion of "八条...")
		// may contain a valid place name that just starts with a digit.
		cityEnd := boundary.Find(searchAddr)
		if cityEnd > 0 && cityEnd < len(searchAddr) {
			afterCity := searchAddr[cityEnd:]
			if isPureNumericContent(afterCity) {
				return true
			}
		}
		return false
	}

	matchedOazaCho := *result.StructuredAddress.OazaCho

	// Check if town names match by comparing characters.
	// Note: Both inputTownName and matchedOazaCho have already been processed by
	// StandardizeSpecialChars, which normalizes ヶ/ケ → ガ variations
	inputRunes := []rune(inputTownName)
	matchedRunes := []rune(matchedOazaCho)

	if len(inputRunes) == 0 || len(matchedRunes) == 0 {
		return false
	}

	// If first character differs, it's a mismatch
	// e.g., 烏ケ辻 vs 石ケ辻 (烏 != 石)
	if inputRunes[0] != matchedRunes[0] {
		return true
	}

	// Check if one is a prefix of the other (valid match)
	// e.g., "烏ケ辻" vs "烏ケ辻町" → prefix match → OK
	// e.g., "神田鍛冶町" vs "神田猿楽町" → neither is prefix → mismatch
	if strings.HasPrefix(inputTownName, matchedOazaCho) || strings.HasPrefix(matchedOazaCho, inputTownName) {
		return false
	}

	// Allow close matches for character variants (e.g., 麩/麸)
	if runeLevenshtein(inputTownName, matchedOazaCho) <= 1 {
		return false
	}

	return true
}

// extractTownNameFromSearch extracts the town name portion from searchAddr.
//
//	e.g., "天王寺区烏ヶ辻町74" -> "烏ヶ辻町"
//	e.g., "千代田区紀尾井町1@:3" -> "紀尾井町"
func extractTownNameFromSearch(boundary *util.CityBoundary, searchAddr string) string {
	cityEndIdx := boundary.Find(searchAddr)
	if cityEndIdx <= 0 || cityEndIdx >= len(searchAddr) {
		return ""
	}

	afterCity := searchAddr[cityEndIdx:]

	// Remove trailing numbers, @, :, - patterns
	// e.g., "烏ヶ辻町74" -> "烏ヶ辻町"
	// e.g., "紀尾井町1@:3" -> "紀尾井町"
	if idx := strings.IndexAny(afterCity, "0123456789@:-"); idx >= 0 {
		return afterCity[:idx]
	}
	return afterCity
}

// Used to distinguish purely numeric content (e.g., "73") from content with place name
// characters (e.g., "8条寺ノ内町:10" or "14号").
func isPureNumericContent(s string) bool {
	for _, ch := range s {
		if (ch < '0' || ch > '9') && ch != '-' && ch != ':' {
			return false
		}
	}
	return len(s) > 0
}
