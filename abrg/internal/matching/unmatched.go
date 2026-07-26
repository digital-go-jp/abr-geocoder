package matching

import (
	"strings"

	"abrg/internal/matching/levenshtein"
	"abrg/internal/matching/unmatched"
	"abrg/internal/model"
)

func setUnmatchedAddress(result *model.MatchedResult, normalizedAddr, adjustedSearchAddr string) {
	searchNumbers := levenshtein.ExtractSearchNumbers(adjustedSearchAddr)
	if searchNumbers != "" && result.StructuredAddress.Chome == nil && levenshtein.IsSearchNumbersPartOfPlaceName(&result.StructuredAddress, searchNumbers) {
		// Don't treat as place name match if original contains 番地 pattern
		// e.g., "二丁目２番地" - the "2" from "２番地" is a block number, not chome
		if !hasBanchiPattern(normalizedAddr) {
			result.UnmatchedAddress = nil
			return
		}
	}

	unmatchedParts := unmatched.ExtractUnmatchedParts(normalizedAddr, result.MatchedAddress, adjustedSearchAddr)
	if len(unmatchedParts) > 0 {
		result.UnmatchedAddress = unmatchedParts
		return
	}

	// No unmatched parts - full match
	result.UnmatchedAddress = nil
}

// hasBanchiPattern checks if the address contains 番地 or 番.
// Prevents treating block numbers as place names (e.g., "２番地" is a block number, not chome).
// Note: May false-positive on place names like 一番町, but acceptable for this use case.
func hasBanchiPattern(s string) bool {
	return strings.Contains(s, "番")
}

// setTwoStageUnmatchedAddress appends unmatched parts to results from TwoStageSearch.
// Unlike setUnmatchedAddress which replaces the unmatched address, this uses append
// because TwoStageSearch may have already set partial unmatched addresses (e.g., "-205").
func setTwoStageUnmatchedAddress(result *model.MatchedResult, normalizedAddr, searchAddr string) {
	parsed := parseSearchAddr(searchAddr)

	if len(parsed.Numbers) > 0 {
		afterColon := strings.Join(parsed.Numbers, "-")
		if remaining := extractUnmatchedAfterParcel(afterColon, result); remaining != "" {
			result.UnmatchedAddress = append(result.UnmatchedAddress, remaining)
		}
	}

	if parsed.Building != "" {
		result.UnmatchedAddress = append(result.UnmatchedAddress, parsed.Building)
	}

	if parts := strings.Split(normalizedAddr, " "); len(parts) > 1 {
		result.UnmatchedAddress = append(result.UnmatchedAddress, parts[1:]...)
	}
}

func extractUnmatchedAfterParcel(afterColon string, result *model.MatchedResult) string {
	parcelPrefix := buildParcelPrefix(result.StructuredAddress)
	if parcelPrefix == "" || !strings.HasPrefix(afterColon, parcelPrefix) {
		return ""
	}
	return strings.TrimPrefix(afterColon[len(parcelPrefix):], "-")
}

func buildParcelPrefix(sa model.StructuredAddress) string {
	if sa.PrcNum1 == nil {
		return ""
	}
	prefix := *sa.PrcNum1
	if sa.PrcNum2 != nil {
		prefix += "-" + *sa.PrcNum2
		if sa.PrcNum3 != nil {
			prefix += "-" + *sa.PrcNum3
		}
	}
	return prefix
}
