// Package levenshtein provides fuzzy address matching using Levenshtein distance.
// This file contains functions for extracting unmatched address parts.
package levenshtein

import (
	"strings"

	"abrg/internal/matching/unmatched"
	"abrg/internal/model"
	"abrg/internal/transform"
	"abrg/internal/util"
)

// matchesPlaceName checks if searchNumbers matches the given place name field.
func matchesPlaceName(placeName *string, searchNumbers string, stripSuffix func(string) string) bool {
	if placeName == nil || searchNumbers == "" {
		return false
	}
	name := *placeName
	normalized, _ := transform.KanjiToArabic(name)

	// Normalize searchNumbers: trim trailing hyphen (e.g., "1-" -> "1")
	searchNumbers = strings.TrimSuffix(searchNumbers, "-")

	// Direct match
	if normalized == searchNumbers || name == searchNumbers {
		return true
	}

	// Match with suffix stripped (e.g., "4号" -> "4", "3丁目" -> "3")
	if stripSuffix != nil {
		stripped := stripSuffix(name)
		normalizedStripped := stripSuffix(normalized)
		if stripped == searchNumbers || normalizedStripped == searchNumbers {
			return true
		}
	}
	return false
}

// IsSearchNumbersPartOfPlaceName reports whether searchNumbers represents a place name component.
func IsSearchNumbersPartOfPlaceName(addr *model.StructuredAddress, searchNumbers string) bool {
	// Check koaza (小字) - e.g., koaza="三五十" normalized to "3510"
	if matchesPlaceName(addr.Koaza, searchNumbers, util.StripGoSuffix) {
		return true
	}
	// Check oaza_cho (大字)
	if matchesPlaceName(addr.OazaCho, searchNumbers, nil) {
		return true
	}
	// Check chome (丁目) - e.g., "3丁目" -> "3"
	if matchesPlaceName(addr.Chome, searchNumbers, util.StripChomeSuffix) {
		return true
	}
	return false
}

// adjustSearchAddrForChome removes the chome prefix from searchNumbers if present.
//
//	e.g., searchNumbers="3-1-5" with chome="3丁目" -> returns "1-5"
func adjustSearchAddrForChome(addr *model.StructuredAddress, searchNumbers, searchAddr string) string {
	if addr.Chome == nil {
		return searchAddr
	}
	chome := *addr.Chome
	chomeNum := util.StripChomeSuffix(chome)
	chomeNum, _ = transform.KanjiToArabic(chomeNum)

	if remaining, found := strings.CutPrefix(searchNumbers, chomeNum+"-"); found {
		return remaining
	}
	return searchAddr
}

// extractUnmatchedAddress extracts the unmatched parts of the address.
// It checks if searchNumbers is part of a place name (koaza/oaza_cho/chome) and handles
// the extraction of remaining unmatched parts accordingly.
func extractUnmatchedAddress(
	searchNumbers string,
	addr *model.StructuredAddress,
	category model.Category,
	searchAddr string,
	normalizedAddr string,
	matchedAddr string,
) []string {
	// Check if searchNumbers matches a place name component
	// e.g., koaza="三五十" becomes "3510" after kanji-to-arabic conversion
	if searchNumbers != "" {
		if IsSearchNumbersPartOfPlaceName(addr, searchNumbers) {
			return nil // nil indicates fully matched (JSON null)
		}

		// Number not matched to place name - include in unmatched parts
		adjustedSearchAddr := adjustSearchAddrForChome(addr, searchNumbers, searchAddr)
		unmatchedParts := unmatched.ExtractUnmatchedParts(normalizedAddr, matchedAddr, adjustedSearchAddr)

		// Check if koaza is fully matched
		if addr.Koaza != nil && strings.Contains(matchedAddr, *addr.Koaza) {
			// No unmatched parts - fully matched
			if len(unmatchedParts) == 0 {
				return nil
			}
			// searchNumbers is a non-numeric suffix that's part of koaza
			// e.g., koaza="壱弐号ヤドミ" with searchNumbers="ヤドミ"
			if !strings.ContainsAny(searchNumbers, "0123456789") && strings.HasSuffix(*addr.Koaza, searchNumbers) {
				return nil
			}
		}

		return unmatchedParts
	}

	// No number to match
	if category == model.CategoryBasic && strings.Contains(searchAddr, "@") {
		return unmatched.ExtractUnmatchedParts(normalizedAddr, matchedAddr, searchAddr)
	}

	remaining := extractUnmatchedSegments(normalizedAddr, matchedAddr)

	// If koaza is fully matched and no remaining text, nothing is unmatched
	if addr.Koaza != nil && strings.Contains(matchedAddr, *addr.Koaza) && len(remaining) == 0 {
		return nil
	}

	return remaining
}

// extractUnmatchedSegments extracts the unmatched portion from normalizedAddr
// by finding where the matched address ends and returning the rest.
//
//	e.g., normalizedAddr="香川県丸亀市原田町字東三分一1926-1", matchedAddr="香川県丸亀市原田町"
//	-> returns ["字東三分一1926-1"]
func extractUnmatchedSegments(originalAddr, matchedAddr string) []string {
	// Split originalAddr into address part and building name parts (separated by space)
	originalAddr = strings.ReplaceAll(originalAddr, "　", " ")
	parts := strings.SplitN(originalAddr, " ", 2)
	addrPart := parts[0]
	var buildingParts []string
	if len(parts) > 1 {
		buildingParts = strings.Split(parts[1], " ")
	}

	// Normalize both addrPart and matchedAddr for comparison (remove 大字, 字)
	addrPartNormalized, _ := util.RemoveOazaAza(addrPart)
	matchedAddrNormalized, _ := util.RemoveOazaAza(matchedAddr)

	// Find where matchedAddr ends in addrPartNormalized
	// matchedAddr e.g., "大分県宇佐市安心院町古川" (12 chars)
	// We need to find the position after "古川" in addrPartNormalized
	matchedNormalizedRunes := []rune(matchedAddrNormalized)

	var unmatchedSuffix string

	// Try to find normalized matchedAddr as prefix in addrPartNormalized
	idx := strings.Index(addrPartNormalized, matchedAddrNormalized)
	if idx == 0 {
		// Perfect prefix match
		suffixEndInNorm := len(matchedNormalizedRunes)
		unmatchedSuffix = mapNormPosToOriginal(addrPart, suffixEndInNorm)
	} else {
		// Try progressively shorter suffixes of normalized matchedAddr
		for suffixLen := min(len(matchedNormalizedRunes), 15); suffixLen >= 2; suffixLen-- {
			suffix := string(matchedNormalizedRunes[len(matchedNormalizedRunes)-suffixLen:])
			idx := strings.LastIndex(addrPartNormalized, suffix)
			if idx >= 0 {
				suffixEndInNorm := idx + len([]rune(suffix))
				unmatchedSuffix = mapNormPosToOriginal(addrPart, suffixEndInNorm)
				break
			}
		}
	}

	// Post-process unmatchedSuffix
	if unmatchedSuffix != "" {
		// Strip "字" only when the unmatched suffix contains digits (aza + house/lot number).
		// Preserve "字" when it's a standalone place name part with no numbers (sub-koaza name).
		// e.g., "字東三分一1926-1" → "東三分一1926-1" (has digits, strip aza marker)
		// e.g., "字堤下" → "字堤下" (no digits, preserve as place name)
		// Note: Additional context-based stripping (e.g., when 大字 is present and koaza is unmatched)
		// is handled by callers like extractUnmatchedAddress that have structured address info.
		if strings.HasPrefix(unmatchedSuffix, "字") && strings.ContainsAny(unmatchedSuffix, "0123456789") {
			unmatchedSuffix = strings.TrimPrefix(unmatchedSuffix, "字")
		}
		unmatchedSuffix = NormalizeUnmatchedNumbers(unmatchedSuffix)
	}

	var result []string
	if unmatchedSuffix != "" {
		result = append(result, unmatchedSuffix)
	}
	if len(buildingParts) > 0 {
		result = append(result, buildingParts...)
	}

	return result
}

// mapNormPosToOriginal maps a position in the normalized address (without 大字/字)
// back to the original address and returns the unmatched suffix.
func mapNormPosToOriginal(addrPart string, normEndPos int) string {
	runes := []rune(addrPart)
	normIdx := 0
	origIdx := 0

	for origIdx < len(runes) && normIdx < normEndPos {
		// Skip 大字 (two-character sequence)
		if origIdx+1 < len(runes) && runes[origIdx] == '大' && runes[origIdx+1] == '字' {
			origIdx += 2
			continue
		}
		// Skip standalone 字
		if runes[origIdx] == '字' {
			origIdx++
			continue
		}
		normIdx++
		origIdx++
	}

	if origIdx < len(runes) {
		return string(runes[origIdx:])
	}
	return ""
}

// isFullWidthDigit checks if rune is a full-width digit (０-９).
func isFullWidthDigit(r rune) bool {
	return r >= '０' && r <= '９'
}

// toHalfWidthDigit converts a full-width digit to half-width.
func toHalfWidthDigit(r rune) rune {
	return r - '０' + '0'
}

// isFullWidthHyphen checks if rune is a full-width hyphen variant.
func isFullWidthHyphen(r rune) bool {
	return r == '−' || r == '－' || r == 'ー' || r == '—' || r == '―'
}

// NormalizeUnmatchedNumbers normalizes number patterns in unmatched address.
//
//	e.g., "東三分一１９２６番地１" -> "東三分一1926-1"
//	e.g., "名字八五十2459" -> "名字八五十2459" (no change needed)
func NormalizeUnmatchedNumbers(s string) string {
	var result strings.Builder
	runes := []rune(s)
	n := len(runes)

	for i := 0; i < n; i++ {
		r := runes[i]

		// Full-width digit to half-width
		if isFullWidthDigit(r) {
			result.WriteRune(toHalfWidthDigit(r))
			continue
		}

		// Full-width hyphen variants to half-width
		if isFullWidthHyphen(r) {
			result.WriteRune('-')
			continue
		}

		// Check for 番地 pattern -> hyphen
		if r == '番' && i+1 < n && runes[i+1] == '地' {
			result.WriteRune('-')
			i++ // skip 地
			continue
		}

		// Check for 番 followed by number -> hyphen
		if r == '番' && i+1 < n && util.IsAddressNumberRune(runes[i+1]) {
			result.WriteRune('-')
			continue
		}

		// Skip trailing 号
		if r == '号' && i == n-1 {
			continue
		}

		result.WriteRune(r)
	}

	// Trim trailing hyphen from patterns like "2013番地" -> "2013-"
	return strings.TrimSuffix(result.String(), "-")
}
