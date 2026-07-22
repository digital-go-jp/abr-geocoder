package matching

import (
	"strings"
	"unicode/utf8"

	"abrg/internal/model"
)

// adjustSearchAddrForMatch adjusts a parsedAddress by removing the matched number from the source string.
// e.g., parsed("港区虎ノ門:1-23-1"), source="1丁目" -> "港区虎ノ門:23-1"
// e.g., parsed("港区虎ノ門1@:23-1"), source="1丁目" -> "港区虎ノ門:23-1"
func adjustSearchAddrForMatch(parsed parsedAddress, source *string) string {
	if source == nil {
		return parsed.String()
	}

	sourceNum := extractFirstNumber(*source)
	if sourceNum == "" {
		return parsed.String()
	}

	// Handle @ pattern: if chome matches source number, remove it
	if parsed.HasChome && parsed.Chome == sourceNum {
		result := parsed
		result.HasChome = false
		result.Chome = ""
		return result.String()
	}

	// Handle colon pattern: if first number matches source number, remove it
	if len(parsed.Numbers) > 0 {
		firstNum := extractFirstNumber(parsed.Numbers[0])
		if firstNum != "" && sourceNum == firstNum {
			result := parsed
			result.Numbers = parsed.Numbers[1:]
			result.LeadingHyphen = false // Leading hyphen was before the removed number
			return result.String()
		}
	}

	return parsed.String()
}

// buildCityBasedSearchAddr builds a search address using city name from structured address.
// This is needed because normalized_address in cache_machiaza doesn't include prefecture.
// e.g., StructuredAddress{City: "下田市"}, chomeSearchAddr="静岡県下田市2@:4-26" -> "下田市2@:4-26"
func buildCityBasedSearchAddr(addr model.StructuredAddress, chomeSearchAddr string) string {
	// Build city prefix from structured address (county + city + ward)
	cityPrefix := derefString(addr.County) + derefString(addr.City) + derefString(addr.Ward)
	if cityPrefix == "" {
		return chomeSearchAddr
	}

	// Find the city prefix in chomeSearchAddr and extract everything after it
	// e.g., "静岡県下田市2@:4-26" -> find "下田市" -> return "下田市2@:4-26"
	idx := strings.Index(chomeSearchAddr, cityPrefix)
	if idx >= 0 {
		return chomeSearchAddr[idx:]
	}

	return chomeSearchAddr
}

// convertColonToChome converts a parsedAddress from "location:N-N" to "locationN@:N" for residential searches.
// e.g., parsed("浦安市舞浜:2-11") -> parsedAddress with Chome="2", Numbers=["11"]
// Returns the input unchanged if conversion is not applicable.
func convertColonToChome(parsed parsedAddress) parsedAddress {
	// Skip if already has chome, or no numbers
	if parsed.HasChome || len(parsed.Numbers) == 0 {
		return parsed
	}

	// Skip conversion if first number starts with alphabet or katakana (e.g., "A-20", "エ-46")
	if startsWithAlphaOrKatakana(parsed.Numbers[0]) {
		return parsed
	}

	firstNum := extractFirstNumber(parsed.Numbers[0])
	if firstNum == "" {
		return parsed
	}

	// Convert to chome pattern: move first number to chome position
	result := parsed
	result.Chome = firstNum
	result.HasChome = true
	result.Numbers = parsed.Numbers[1:]
	result.LeadingHyphen = false // Leading hyphen was before the first number, now consumed

	return result
}

// startsWithAlphaOrKatakana checks if the string starts with A-Z or katakana.
func startsWithAlphaOrKatakana(s string) bool {
	if s == "" {
		return false
	}
	r, _ := utf8.DecodeRuneInString(s)
	return (r >= 'A' && r <= 'Z') || (r >= 'a' && r <= 'z') || (r >= 'ア' && r <= 'ン')
}
