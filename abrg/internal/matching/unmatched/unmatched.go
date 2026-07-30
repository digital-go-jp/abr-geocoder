// Package unmatched extracts the unmatched (residual) parts of an address —
// the portion of the user input that the matched database record does not
// cover, plus building/floor/room tokens — for the matching pipeline.
package unmatched

import (
	"slices"
	"strings"

	"abrg/internal/char"
	"abrg/internal/model"
	"abrg/internal/util"
)

// CreateUnmatchedResult creates a result with the entire address as unmatched.
// Uses original address format for user-friendly display.
func CreateUnmatchedResult(originalAddr string) model.MatchedResult {
	// Use original address parts for unmatched display
	parts := strings.Split(originalAddr, " ")

	return model.MatchedResult{
		MatchedAddress:    "",
		UnmatchedAddress:  parts,
		MatchLevel:        model.MatchLevelUnknown,
		Score:             -1,
		IDs:               model.IDs{},
		StructuredAddress: model.StructuredAddress{},
	}
}

// Addresses holds the three forms of one address that unmatched-part
// extraction compares. Naming them keeps a caller from swapping two.
type Addresses struct {
	// Normalized is the basic-normalized input, building name included
	// (e.g. "東京都中央区八丁堀四丁目12-7 サニービル").
	Normalized string
	// Matched is what the database matched (e.g. "東京都文京区大塚1丁目").
	// It drives chome pattern detection.
	Matched string
	// Search is the fully transformed search form (e.g. "中央区8丁堀4@:12-7").
	Search string
}

// ExtractUnmatchedParts extracts unmatched parts from a normalized address.
// Returns user-friendly unmatched parts with building names as separate elements.
//
// The address portion comes from addr.Search, so it may still hold
// transformed forms like "8丁" and "@".
func ExtractUnmatchedParts(addr Addresses) []string {
	normalizedAddr, matchedAddr, searchAddr := addr.Normalized, addr.Matched, addr.Search
	var unmatchedParts []string

	// Split normalizedAddr into address part and building name
	standardizedAddrPart, buildingParts := SplitStandardizedAddress(normalizedAddr)

	// Use matchedAddr for chome pattern detection (e.g., "東京都文京区大塚1丁目")
	// This contains the address that was actually matched in the database
	addressPart := matchedAddr

	// If searchAddr contains ":" notation, it indicates internal processing format
	// e.g., "港区虎ノ門:23-1" means "虎ノ門" is matched, and "23-1" is unmatched
	// e.g., "千代田区紀尾井町1@:3" means "紀尾井町" is matched, and "1@:3" (1丁目3) is unmatched
	beforeColon, afterColon, hasColon := strings.Cut(searchAddr, ":")

	unmatchedAddr := addressPart
	if hasColon && afterColon != "" {
		unmatchedAddr = extractUnmatchedWithColon(normalizedAddr, standardizedAddrPart, addressPart, beforeColon, afterColon)
	} else if searchAddr == "" {
		// Empty searchAddr means no specific unmatched portion to extract
		// This happens when everything matched or we only want building names
		unmatchedAddr = ""
	} else if strings.Contains(searchAddr, "@") && !hasColon {
		// If searchAddr contains "@" without ":", check if there are numbers after "@"
		// e.g., "中央区入舟3@4-1" means "入舟3丁目" is matched, and "4-1" is unmatched
		// e.g., "文京区大塚1@" means "大塚1丁目" is fully matched (no unmatched part)

		unmatchedAddr = extractUnmatchedWithAt(searchAddr)
	} else if !hasColon && searchAddr != "" {
		// No ":" or "@" in searchAddr. What follows matchedAddr in the input is
		// the unmatched part, and it preserves the original form (e.g. kanji
		// numerals). An empty remainder means the input matched in full.
		after, isPrefix := strings.CutPrefix(standardizedAddrPart, matchedAddr)
		if isPrefix {
			unmatchedAddr = after
		} else {
			// The input and matchedAddr are spelled differently, so the remainder
			// cannot be located by position. Take the trailing numbers instead.
			unmatchedAddr = util.ExtractTrailingAddressNumbers(searchAddr)
		}
	}

	// Add the unmatched address part
	if unmatchedAddr != "" {
		unmatchedParts = append(unmatchedParts, unmatchedAddr)
	}

	// Add building name parts (from normalizedAddr) as separate elements
	// This ensures building names, floor numbers, and room numbers appear separately
	if len(buildingParts) > 0 {
		unmatchedParts = append(unmatchedParts, buildingParts...)
	}

	return unmatchedParts
}

// SplitStandardizedAddress splits a space-delimited standardized address into
// the address proper (first element) and building/floor/room tokens (remaining).
func SplitStandardizedAddress(normalizedAddr string) (string, []string) {
	standardizedParts := strings.Split(normalizedAddr, " ")
	return standardizedParts[0], standardizedParts[1:]
}

func extractUnmatchedWithColon(originalAddr, standardizedAddrPart, matchedAddr, beforeColon, afterColon string) string {
	// Check if there's a "@" before the colon (e.g., "千代田区紀尾井町1@:3")
	// This indicates chome number that should be included in unmatched part
	if strings.Contains(beforeColon, "@") {
		return extractUnmatchedWithColonAt(originalAddr, standardizedAddrPart, matchedAddr, beforeColon, afterColon)
	}

	// No "@" before ":", extract unmatched portion
	// e.g., searchAddr="文京区大塚:1-0" means "大塚" matched, "1-0" unmatched
	// But if normalizedAddr contains "X丁目", it means "1" was interpreted as chome
	// and we should only extract after the chome (e.g., "0")

	// First, check if beforeColon contains more than what matchedAddr covers
	// e.g., beforeColon="嬉野市嬉野町下野長波須ハ丙", matchedAddr="佐賀県嬉野市嬉野町大字下野"
	// The unmatched prefix is "長波須ハ丙" (koaza not in DB)
	unmatchedPrefix := extractUnmatchedPrefixFromBeforeColon(beforeColon, matchedAddr)

	// When extractUnmatchedPrefixFromBeforeColon fails (e.g., due to 之→ノ normalization mismatch
	// or katakana/hiragana differences), try to extract from standardizedAddrPart which preserves
	// the original characters (including "字" and "之").
	if after, found := strings.CutPrefix(standardizedAddrPart, matchedAddr); found && afterColon != "" {
		trimmed := strings.TrimSuffix(after, afterColon)
		if trimmed != "" && trimmed != after {
			trimmed = stripAzaMarker(trimmed)
			if trimmed != "" {
				unmatchedPrefix = trimmed
			}
		}
	}

	afterPart := extractUnmatchedWithColonNoAt(originalAddr, standardizedAddrPart, matchedAddr, afterColon)

	if unmatchedPrefix != "" && afterPart != "" {
		return unmatchedPrefix + afterPart
	}
	if unmatchedPrefix != "" {
		return unmatchedPrefix
	}
	return afterPart
}

func extractUnmatchedWithColonAt(originalAddr, standardizedAddrPart, matchedAddr, beforeColon, afterColon string) string {
	// Extract chome number that comes after @ but before :
	// e.g., "千代田区紀尾井町1@" -> we need to extract "1"
	// A leading "@" leaves no room for a chome, so there is nothing to recover.
	if atIndex := strings.LastIndex(beforeColon, "@"); atIndex <= 0 {
		return afterColon
	}

	parts := strings.Split(beforeColon, "@")
	if len(parts) < 2 {
		return afterColon
	}

	// Find the chome number at the end of the part before @
	beforeAt := parts[0]
	// Extract trailing digits from beforeAt (e.g., "千代田区紀尾井町1" -> "1")
	chomeNum := util.ExtractChomeDigits(beforeAt)

	// Get the part after @ (e.g., "大阪市中央区久太郎町4@渡辺" -> "渡辺")
	afterAt := parts[1]

	if chomeNum != "" {
		// Check if matchedAddr contains "丁目" - if yes, the chome was matched
		// This handles both arabic (3丁目) and kanji (三丁目) numerals
		if strings.Contains(matchedAddr, "丁目") {
			// Chome was matched (either as "3丁目" or "三丁目")
			// Include the part after @ (e.g., "渡辺") if it's not empty, not just numbers,
			// AND not already matched (not in matchedAddr)
			// e.g., "久太郎町4@渡辺:3" -> "渡辺3" (渡辺 is not in matchedAddr)
			// e.g., "京町8@横町:63" -> "63" (横町 is already in matchedAddr)
			if afterAt != "" && !isAllDigits(afterAt) && !strings.Contains(matchedAddr, afterAt) {
				if afterColon != "" {
					return afterAt + afterColon
				}
				return afterAt
			}
			return afterColon
		}

		// Chome was NOT matched, need to include it in unmatched
		// Look for chomeNum + "丁目" pattern in standardizedAddrPart to get the full unmatched portion
		pattern := chomeNum + "丁目"
		idx := strings.Index(standardizedAddrPart, pattern)

		if idx != -1 {
			// Found the pattern in standardizedAddrPart
			afterChome := standardizedAddrPart[idx+len(pattern):]

			// Check if user explicitly specified "X丁目"
			hasChomeInOriginal := strings.Contains(originalAddr, pattern) || strings.Contains(originalAddr, "丁目")
			if hasChomeInOriginal && afterChome == afterColon && !strings.Contains(afterColon, "-") {
				// Chome was NOT matched, include it in unmatched
				return standardizedAddrPart[idx:]
			}
			// This shouldn't happen if matchedAddr doesn't contain "丁目"
			return afterColon
		}

		// Pattern not found even in standardizedAddrPart
		// Combine chomeNum with afterColon
		if afterColon != "" {
			return chomeNum + "-" + afterColon
		}
		return chomeNum
	}

	if afterColon != "" {
		return afterColon
	}
	return matchedAddr
}

// extractUnmatchedPrefixFromBeforeColon extracts the unmatched portion from beforeColon
// by comparing with matchedAddr. This handles cases where the search address contains
// koaza (小字) that doesn't exist in the database.
//
// Example: beforeColon="嬉野市嬉野町下野長波須ハ丙", matchedAddr="佐賀県嬉野市嬉野町大字下野"
// returns "長波須ハ丙".
func extractUnmatchedPrefixFromBeforeColon(beforeColon, matchedAddr string) string {
	// Normalize both for comparison (remove prefecture, 大字, 字)
	normalizedBefore := beforeColon
	normalizedMatched := matchedAddr

	// Remove prefecture prefix from matchedAddr for comparison
	// Prefecture is in matchedAddr but not in beforeColon (which is from searchAddr)
	normalizedMatched = stripPrefecture(normalizedMatched)

	// Remove 大字 and 字 from both
	normalizedBefore, _ = util.RemoveOazaAza(normalizedBefore)
	normalizedMatched, _ = util.RemoveOazaAza(normalizedMatched)

	// Find where normalizedMatched ends in normalizedBefore
	// e.g., normalizedBefore="嬉野市嬉野町下野長波須ハ丙", normalizedMatched="嬉野市嬉野町下野"
	// -> unmatched is "長波須ハ丙"
	if strings.HasPrefix(normalizedBefore, normalizedMatched) {
		unmatched := normalizedBefore[len(normalizedMatched):]
		if unmatched != "" {
			return unmatched
		}
	}

	// Try to find the longest common suffix of matchedAddr in beforeColon
	// and extract what comes after it
	matchedRunes := []rune(normalizedMatched)
	for suffixLen := min(len(matchedRunes), 10); suffixLen >= 2; suffixLen-- {
		suffix := string(matchedRunes[len(matchedRunes)-suffixLen:])
		if idx := strings.LastIndex(normalizedBefore, suffix); idx >= 0 {
			unmatched := normalizedBefore[idx+len(suffix):]
			if unmatched != "" {
				return unmatched
			}
			break
		}
	}

	return ""
}

func extractUnmatchedWithColonNoAt(originalAddr, standardizedAddrPart, matchedAddr, afterColon string) string {
	// Check if afterColon starts with digits followed by hyphen
	// and matchedAddr/normalizedAddr contains "X丁目" pattern
	if strings.Contains(afterColon, "-") {
		// e.g., afterColon = "1-0" or "3-5-3-2414"
		// Extract the leading number before first hyphen
		firstHyphenIdx := strings.Index(afterColon, "-")
		if firstHyphenIdx > 0 {
			leadingNum := afterColon[:firstHyphenIdx]
			chomePattern := leadingNum + "丁目"
			// Check if matchedAddr or standardizedAddrPart contains the specific chome pattern (arabic or kanji)
			// e.g., "3丁目" (arabic) or "三丁目" (kanji)
			hasChome := strings.Contains(matchedAddr, chomePattern) ||
				strings.Contains(standardizedAddrPart, chomePattern)
			if hasChome {
				// The leading number is the chome, return what comes after first hyphen
				return afterColon[firstHyphenIdx+1:]
			}

			// Trailing hyphen after digits (e.g., "1-") → chome number with nothing after
			// The digits are consumed as chome, trailing hyphen is just punctuation
			if afterColon[firstHyphenIdx+1:] == "" && isAllDigits(leadingNum) {
				return ""
			}
		}
		// No chome pattern, use afterColon as-is
		return afterColon
	}

	// afterColon doesn't contain hyphen

	// Check if the bare number was fully consumed as chome
	// e.g., afterColon="2" and matchedAddr contains "二丁目" → nothing unmatched
	if strings.Contains(matchedAddr, "丁目") && isAllDigits(afterColon) {
		return ""
	}

	// For N線M号 pattern, map back to original kanji representation
	// e.g., afterColon="1号" should map back to "一号" from originalAddr
	if strings.HasSuffix(afterColon, "号") && strings.Contains(originalAddr, "号") {
		if originalNum, ok := extractOriginalGoNumber(originalAddr); ok {
			return originalNum
		}
	}
	return afterColon
}

// isAllDigits checks if a string is non-empty and consists entirely of ASCII digits.
func isAllDigits(s string) bool {
	if s == "" {
		return false
	}
	for i := 0; i < len(s); i++ {
		if !char.IsASCIIDigit(s[i]) {
			return false
		}
	}
	return true
}

func extractOriginalGoNumber(originalAddr string) (string, bool) {
	// Convert to runes for proper UTF-8 handling
	runes := []rune(originalAddr)
	// Find the last 号 in originalAddr
	goIdx := -1
	for i, r := range slices.Backward(runes) {
		if r == '号' {
			goIdx = i
			break
		}
	}
	if goIdx <= 0 {
		return "", false
	}

	// Walk backwards to find the start of the number representation
	start := goIdx - 1
	for start >= 0 {
		r := runes[start]
		// Check if this is a kanji numeral or regular digit
		if util.IsAddressNumberRune(r) {
			start--
		} else {
			break
		}
	}
	start++ // Move back to the first character of the number
	return string(runes[start : goIdx+1]), true
}

func extractUnmatchedWithAt(searchAddr string) string {
	if _, afterAt, found := strings.Cut(searchAddr, "@"); found && afterAt != "" {
		return afterAt
	}
	return ""
}

// stripAzaMarker strips the "字" (aza) prefix from an unmatched address component
// when it is a marker rather than part of the place name.
//
// s is the koaza with the lot number already split off by the caller, so the
// decision rests on the name alone.
//
// Strips "字" when:
//   - s is exactly "字", leaving nothing
//   - the text after "字" ends with a kanji numeral, marking a numbered koaza
//     where "字" introduces the number (e.g. "字家六" → "家六")
//
// Preserves "字" when the remaining text is a place name (e.g. "字上ノ原", "字堤下").
//
// levenshtein.extractUnmatchedSegments is the sibling rule for input that still
// carries the lot number, which is why it keys on digits instead.
func stripAzaMarker(s string) string {
	if !strings.HasPrefix(s, "字") {
		return s
	}
	afterAza := strings.TrimPrefix(s, "字")
	if afterAza == "" {
		return ""
	}
	runes := []rune(afterAza)
	if util.IsKanjiNumeral(runes[len(runes)-1]) {
		return afterAza
	}
	return s
}

// stripPrefecture removes a prefecture prefix from an address string by
// position heuristic (都/府/県 at rune index 2-3, plus 北海道), without needing
// a prefecture code. It may return an empty string and keeps any leading space.
// Deliberately separate from matching's removePrefectureFromAddress, which
// removes only the exact name for a given prefecture code, trims leading
// spaces, and returns the input unchanged when nothing would remain.
func stripPrefecture(addr string) string {
	if strings.HasPrefix(addr, "北海道") {
		return addr[len("北海道"):]
	}
	runes := []rune(addr)
	for i, r := range runes {
		if (r == '都' || r == '府' || r == '県') && i >= 2 && i <= 3 {
			return string(runes[i+1:])
		}
		if i >= 4 {
			break
		}
	}
	return addr
}
