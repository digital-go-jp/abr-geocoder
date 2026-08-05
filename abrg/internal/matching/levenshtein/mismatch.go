// Package levenshtein provides fuzzy address matching using Levenshtein distance.
// This file contains match validation functions for filtering false-positive fuzzy matches.
package levenshtein

import (
	"strings"

	"abrg/internal/char"
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
	inputTownName, cityEnd := extractTownNameFromSearch(boundary, searchAddr)
	if inputTownName == "" {
		// No town name extracted - check if the content after city is purely numeric.
		// Purely numeric content (e.g., "南関町73") means the digits are being wrongly
		// matched to a place name (e.g., "大字今"), so flag as mismatch.
		// Non-numeric content (e.g., "8条寺ノ内町:10" from kanji conversion of "八条...")
		// may contain a valid place name that just starts with a digit.
		if cityEnd > 0 && cityEnd < len(searchAddr) {
			afterCity := searchAddr[cityEnd:]
			if isPureNumericContent(afterCity) {
				return true
			}
		}
		return false
	}

	// oaza_cho keeps the 大字/字 prefix that the search address has already had
	// removed, so compare against the name with and without it. Both forms are
	// needed: 猪高町猪子石原 only agrees with the stripped 猪高町大字猪子石原,
	// while an input that misspells the prefix (大宇向町) only agrees with the raw one.
	rawOazaCho := *result.StructuredAddress.OazaCho
	if townNamesAgree(inputTownName, rawOazaCho) {
		return false
	}

	strippedOazaCho, _ := transform.TextForDB(rawOazaCho)
	return !townNamesAgree(inputTownName, strippedOazaCho)
}

// townNamesAgree reports whether an input town name and a DB town name name the
// same town. One may be a prefix of the other (烏ケ辻 and 烏ケ辻町) and they may
// differ by a single character (麩 and 麸), but a differing first character is
// never the same town (烏ケ辻 and 石ケ辻).
func townNamesAgree(input, dbName string) bool {
	inputRunes := []rune(input)
	dbRunes := []rune(dbName)
	if len(inputRunes) == 0 || len(dbRunes) == 0 {
		return true
	}
	if inputRunes[0] != dbRunes[0] {
		return false
	}
	if strings.HasPrefix(input, dbName) || strings.HasPrefix(dbName, input) {
		return true
	}
	return runeLevenshtein(input, dbName) <= 1
}

// extractTownNameFromSearch extracts the town name portion from searchAddr,
// along with the city boundary index it was cut at so callers can reuse it.
//
//	e.g., "天王寺区烏ヶ辻町74" -> "烏ヶ辻町"
//	e.g., "千代田区紀尾井町1@:3" -> "紀尾井町"
func extractTownNameFromSearch(boundary *util.CityBoundary, searchAddr string) (string, int) {
	cityEndIdx := boundary.Find(searchAddr)
	if cityEndIdx <= 0 || cityEndIdx >= len(searchAddr) {
		return "", cityEndIdx
	}

	afterCity := searchAddr[cityEndIdx:]

	// Remove trailing numbers, @, :, - patterns
	// e.g., "烏ヶ辻町74" -> "烏ヶ辻町"
	// e.g., "紀尾井町1@:3" -> "紀尾井町"
	if idx := strings.IndexAny(afterCity, "0123456789@:-"); idx >= 0 {
		return afterCity[:idx], cityEndIdx
	}
	return afterCity, cityEndIdx
}

// Used to distinguish purely numeric content (e.g., "73") from content with place name
// characters (e.g., "8条寺ノ内町:10" or "14号").
func isPureNumericContent(s string) bool {
	for _, ch := range s {
		if !char.IsASCIIDigit(ch) && ch != '-' && ch != ':' {
			return false
		}
	}
	return len(s) > 0
}
