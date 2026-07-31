package matching

import (
	"context"
	"strings"

	"abrg/internal/char"
	"abrg/internal/matching/levenshtein"
	"abrg/internal/model"
	"abrg/internal/repository"
	"abrg/internal/transform"
)

// basicFinder is a consumer-defined interface for basic address lookup.
type basicFinder interface {
	FindBasicByAddress(ctx context.Context, params repository.BasicSearchParams) ([]repository.BasicResult, error)
}

// maxJaccardCandidates is the maximum number of candidates to retrieve for jaccard-based selection.
// This is needed because some addresses have multiple DB records with the same normalized_address
// but different character variants in oaza_cho or koaza (e.g., "大一本松" vs "大1本松", "八の坪" vs "8の坪").
// We fetch multiple candidates and then select the best match based on jaccard similarity to the original input.
// Current DB stats: max 5 duplicates (1 address), 4 duplicates (10 addresses), 3 duplicates (38 addresses).
const maxJaccardCandidates = 5

// extractFirstNumberWithHyphen extracts the first number sequence followed by hyphen.
// e.g., "文京区大塚5-18-5-802" -> ("文京区大塚", "5-18-5-802", true, false)
// e.g., "文京区大塚1-" -> ("文京区大塚", "1", true, true) - trailing hyphen treated as chome indicator
// e.g., "中央区東日本橋" -> ("", "", false, false)
//
// koazaSuffixes are address components that should not be split from preceding N-M patterns.
// e.g., "11-2街区" should remain intact, not split into base="..." and after="11-2街区".
var koazaSuffixes = []string{"街区", "地割", "分区", "番川", "番通"}

func extractFirstNumberWithHyphen(address string) (base, after string, found, trailingHyphen bool) {
	for i := 0; i < len(address); i++ {
		if !char.IsASCIIDigit(address[i]) {
			continue
		}

		// Found a digit - skip consecutive digits to find end of number
		numEnd := skipDigits(address, i)

		// Must be followed by hyphen
		if numEnd >= len(address) || address[numEnd] != '-' {
			continue
		}

		// Trailing hyphen case: "1-"
		if numEnd+1 >= len(address) {
			return address[:i], address[i:numEnd], true, true
		}

		// Must have digit after hyphen for valid N-M pattern
		if !char.IsASCIIDigit(address[numEnd+1]) {
			continue
		}

		// Skip second number to check for koaza suffix
		secondNumEnd := skipDigits(address, numEnd+1)
		if hasKoazaSuffix(address[secondNumEnd:]) {
			i = secondNumEnd - 1 // Continue searching after koaza pattern
			continue
		}

		return address[:i], address[i:], true, false
	}
	return "", "", false, false
}

func skipDigits(s string, start int) int {
	i := start
	for i < len(s) && char.IsASCIIDigit(s[i]) {
		i++
	}
	return i
}

func hasKoazaSuffix(s string) bool {
	for _, suffix := range koazaSuffixes {
		if strings.HasPrefix(s, suffix) {
			return true
		}
	}
	return false
}

// buildFallbackAddress creates a fallback address with number@ pattern.
// e.g., ("千代田区紀尾井町", "1-3") -> ("千代田区紀尾井町1@", ":3")
// e.g., ("千代田区神田鍛冶町", "3-1-2") -> ("千代田区神田鍛冶町3@", ":1-2")
// e.g., ("千代田区紀尾井町", "文字列") -> ("", "")
func buildFallbackAddress(baseAddress, afterColon string) (string, string) {
	end := skipDigits(afterColon, 0)
	if end == 0 {
		return "", ""
	}

	newBase := baseAddress + afterColon[:end] + "@"
	rest := strings.TrimPrefix(afterColon[end:], "-")
	if rest == "" {
		return newBase, ""
	}
	return newBase, ":" + rest
}

// detectMachiaza tries to detect lg_code and machiaza_id by searching for city/town/village names in the database.
// Returns []model.MatchedResult with exact match (limit 1).
// NOTE: This function returns the BASE record (without chome adjustment).
// Chome adjustment is handled in impl.go based on category type (residential vs parcel).
// originalAddr is the original user input (before normalization), used for jaccard-based selection
// when multiple candidates have the same normalized_address but different koaza.
func detectMachiaza(ctx context.Context, repo basicFinder, address string, prefCode string, originalAddr string) ([]model.MatchedResult, string, error) {
	// Split address by colon (format: "町字名:数字部分")
	baseAddress, afterColon, found := strings.Cut(address, ":")

	// If colon not found, try to extract from hyphenated format
	// e.g., "文京区大塚5-18-5-802" -> ("文京区大塚", "5-18-5-802")
	wasHyphenated := false
	isTrailingHyphen := false
	if !found {
		base, after, hasHyphen, trailing := extractFirstNumberWithHyphen(address)
		if hasHyphen {
			baseAddress = base
			afterColon = after
			found = true
			wasHyphenated = true
			isTrailingHyphen = trailing
		}
	}

	// Handle "@-N": a chome marker followed directly by the address numbers.
	// A written-out chome plus a hyphen leaves this behind wherever AddColon
	// did not already mark the boundary itself
	// (e.g. "銀座1丁目-5-2" -> "銀座1@-5-2").
	if !found {
		if atHyphenIdx := strings.Index(address, "@-"); atHyphenIdx >= 0 {
			rest := address[atHyphenIdx+2:]
			if len(rest) > 0 && char.IsASCIIDigit(rest[0]) {
				baseAddress = address[:atHyphenIdx+1]
				afterColon = rest
				found = true
			}
		}
	}

	// Try base address first
	// For trailing hyphen case (e.g., "大塚1-"), search for "大塚1@" instead of "大塚"
	searchKey := baseAddress
	if isTrailingHyphen {
		searchKey = baseAddress + afterColon + "@"
	}

	results, err := queryAddressResults(ctx, repo, searchKey, prefCode, originalAddr)
	if err != nil {
		return nil, address, err
	}
	if len(results) > 0 {
		r, s := handleBaseMatch(results, baseAddress, afterColon, address, found, wasHyphenated)
		return r, s, nil
	}

	// If not found and there's a colon or hyphen pattern, try fallback patterns
	if found {
		r, s, err := tryMachiazaFallbackSearch(ctx, repo, baseAddress, afterColon, prefCode, originalAddr)
		if err != nil {
			return nil, address, err
		}
		if len(r) > 0 {
			return r, s, nil
		}
	}

	// Try to match N線M号 pattern (Hokkaido colonial division addresses)
	if senBase, senSuffix, hasSenGo := transform.ExtractSenGoSuffix(address); hasSenGo {
		senResults, err := queryAddressResults(ctx, repo, senBase, prefCode, originalAddr)
		if err != nil {
			return nil, address, err
		}
		if len(senResults) > 0 {
			return senResults, senBase + ":" + senSuffix, nil
		}
	}

	return []model.MatchedResult{}, address, nil
}

// handleBaseMatch processes results when base address matches.
func handleBaseMatch(results []model.MatchedResult, baseAddress, afterColon, address string, found, wasHyphenated bool) ([]model.MatchedResult, string) {
	if !wasHyphenated {
		if !found {
			return results, ""
		}
		return results, address
	}

	// Hyphenated format: convert to colon format for consistency
	if strings.Contains(afterColon, "-") {
		return results, baseAddress + ":" + afterColon
	}
	return results, baseAddress + afterColon + "@"
}

// tryMachiazaFallbackSearch attempts fallback search patterns (chome search).
func tryMachiazaFallbackSearch(ctx context.Context, repo basicFinder, baseAddress, afterColon, prefCode, originalAddr string) ([]model.MatchedResult, string, error) {
	fallbackBase, fallbackAfter := buildFallbackAddress(baseAddress, afterColon)
	if fallbackBase == "" {
		return nil, "", nil
	}

	results, err := queryAddressResults(ctx, repo, fallbackBase, prefCode, originalAddr)
	if err != nil {
		return nil, "", err
	}
	if len(results) > 0 {
		return results, fallbackBase + fallbackAfter, nil
	}
	return nil, "", nil
}

// queryAddressResults executes the database query and returns full MatchedResult.
// When multiple candidates have the same normalized_address but different koaza,
// selects the one most similar to originalAddr using jaccard similarity.
func queryAddressResults(ctx context.Context, repo basicFinder, address string, prefCode string, originalAddr string) ([]model.MatchedResult, error) {
	basicResults, err := repo.FindBasicByAddress(ctx, repository.BasicSearchParams{
		Address:  address,
		PrefCode: prefCode,
		Limit:    maxJaccardCandidates,
	})
	if err != nil {
		return nil, err
	}

	results := make([]model.MatchedResult, 0, len(basicResults))
	for i := range basicResults {
		results = append(results, repository.BasicResultToNormalized(&basicResults[i]))
	}
	ambiguousFlg := hasAmbiguousRsdtAddrFlg(results)

	// Select best match when multiple candidates exist
	if len(results) > 1 {
		if originalAddr != "" {
			// Use jaccard similarity to select the variant closest to original input
			// (e.g., "大一本松" prefers oaza_cho "大一本松" over "大1本松",
			//        "八の坪" prefers koaza "八の坪" over "8の坪")
			results = levenshtein.SelectBestByJaccard(results, originalAddr)
		} else {
			// No originalAddr provided, just take the first (highest priority by ORDER BY)
			results = results[:1]
		}
	}

	// A machiaza where 住居表示実施/非実施 coexist has one row per flag in ABR, so
	// which side the address belongs to is unknown at machiaza level (issue #262).
	// v2 represented this as AMBIGUOUS_RSDT_ADDR_FLG (-1); v3 uses null.
	for i := range results {
		if results[i].IDs.LgCode != nil && results[i].IDs.MachiazaID != nil &&
			ambiguousFlg[*results[i].IDs.LgCode+*results[i].IDs.MachiazaID] {
			results[i].IDs.RsdtAddrFlg = nil
		}
	}

	return results, nil
}

// hasAmbiguousRsdtAddrFlg reports, per lg_code+machiaza_id, whether the candidates
// contain rows with differing rsdt_addr_flg.
func hasAmbiguousRsdtAddrFlg(results []model.MatchedResult) map[string]bool {
	// Ambiguity needs at least two rows; skip the map allocations for the
	// common single-candidate case (nil map reads are safe for callers).
	if len(results) < 2 {
		return nil
	}
	seen := make(map[string]string, len(results))
	ambiguous := make(map[string]bool)
	for i := range results {
		ids := &results[i].IDs
		if ids.LgCode == nil || ids.MachiazaID == nil || ids.RsdtAddrFlg == nil {
			continue
		}
		key := *ids.LgCode + *ids.MachiazaID
		if prev, ok := seen[key]; ok && prev != *ids.RsdtAddrFlg {
			ambiguous[key] = true
		}
		seen[key] = *ids.RsdtAddrFlg
	}
	return ambiguous
}
