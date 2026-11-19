package matching

import (
	"context"
	"strings"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/char"
	"github.com/digital-go-jp/abr-geocoder/abrg/internal/matching/levenshtein"
	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
	"github.com/digital-go-jp/abr-geocoder/abrg/internal/repository"
	"github.com/digital-go-jp/abr-geocoder/abrg/internal/transform"
)

// basicFinder is a consumer-defined interface for basic address lookup.
type basicFinder interface {
	FindBasicByAddress(ctx context.Context, params repository.BasicSearchParams) ([]repository.BasicResult, error)
	ParcelLotMatch(ctx context.Context, lgCode, machiazaID, prcNum1, prcNum2 string) (repository.LotMatch, error)
	ResidentialLotMatch(ctx context.Context, lgCode, machiazaID, blkNum, rsdtNum string) (repository.LotMatch, error)
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
// lot chooses among same-named candidates by the parcels and residential numbers they hold.
// A number split off address itself takes the place of lot.numbers.
func detectMachiaza(ctx context.Context, repo basicFinder, address, prefCode, originalAddr string, lot lotQuery) ([]model.MatchedResult, string, error) {
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

	if found {
		lot.numbers = afterColon
	}

	// Try base address first
	// For trailing hyphen case (e.g., "大塚1-"), search for "大塚1@" instead of "大塚"
	searchKey := baseAddress
	if isTrailingHyphen {
		searchKey = baseAddress + afterColon + "@"
		// The number is the chome, and no lot follows it.
		lot.numbers = ""
	}

	results, err := queryAddressResults(ctx, repo, searchKey, prefCode, originalAddr, lot)
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
		senResults, err := queryAddressResults(ctx, repo, senBase, prefCode, originalAddr, lotQuery{})
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

	results, err := queryAddressResults(ctx, repo, fallbackBase, prefCode, originalAddr, lotQuery{})
	if err != nil {
		return nil, "", err
	}
	if len(results) > 0 {
		return results, fallbackBase + fallbackAfter, nil
	}
	return nil, "", nil
}

// queryAddressResults executes the database query and returns full MatchedResult.
// When multiple candidates have the same normalized_address,
// selectHoldingLot chooses one by jaccard similarity to originalAddr and by the input lot.
func queryAddressResults(ctx context.Context, repo basicFinder, address, prefCode, originalAddr string, lot lotQuery) ([]model.MatchedResult, error) {
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
			results, err = selectHoldingLot(ctx, repo, results, levenshtein.TopByJaccard(results, originalAddr), originalAddr, lot)
			if err != nil {
				return nil, err
			}
		} else {
			// No originalAddr provided, just take the first (highest priority by ORDER BY)
			results = results[:1]
		}
	}

	// A machiaza where 住居表示実施/非実施 coexist has one row per flag in ABR, so
	// which side the address belongs to is unknown at machiaza level, so the flag
	// is reported as null (issue #262).
	for i := range results {
		if results[i].IDs.LgCode != nil && results[i].IDs.MachiazaID != nil &&
			ambiguousFlg[*results[i].IDs.LgCode+*results[i].IDs.MachiazaID] {
			results[i].IDs.RsdtAddrFlg = nil
		}
	}

	return results, nil
}

// selectHoldingLot returns the candidate the input lot is in.
// Among top, the candidates tied by spelling, it prefers the one holding the most of the lot.
// Same-named machiaza that differ only in 大字 or 字 can both hold numbers,
// and only the input lot tells which of them the address is in.
// When none of top holds the lot and top[0] holds no numbers at all,
// the candidates spelled differently are looked up the same way,
// because a same-named machiaza spelled differently (萬願寺 for 万願寺) may hold the numbers of the area.
// Two spellings that both hold numbers are separate areas, so the spelling decides there.
// Among candidates holding the lot equally, the spelling of originalAddr with 大字 and 字 decides.
// top[0] is returned when no candidate holds the lot.
func selectHoldingLot(ctx context.Context, repo basicFinder, all, top []model.MatchedResult, originalAddr string, lot lotQuery) ([]model.MatchedResult, error) {
	num1, num2 := splitLot(lot.numbers)
	if num1 == "" {
		return top[:1], nil
	}
	var holders []model.MatchedResult
	var err error
	if spansMachiaza(top) {
		holders, err = bestLotHolders(ctx, repo, top, lot.category, num1, num2)
		if err != nil {
			return nil, err
		}
	}
	if len(holders) == 0 && top[0].Machiaza.ParcelCount == 0 && top[0].Machiaza.RsdtdspCount == 0 {
		holders, err = bestLotHolders(ctx, repo, all, lot.category, num1, num2)
		if err != nil {
			return nil, err
		}
	}
	if len(holders) == 0 {
		return top[:1], nil
	}
	return levenshtein.TopByJaccardAsWritten(holders, originalAddr)[:1], nil
}

// How much of the input lot a candidate holds, from least to most.
const (
	lotHeldPrcNum1 = iota + 1 // a parcel matching prc_num1 alone
	lotHeldBlock              // a residential block matching prc_num1 alone
	lotHeldWhole              // a parcel or residential number matching the whole lot
)

// bestLotHolders returns the candidates holding the most of the lot, in their order,
// or none when no candidate holds any of it.
func bestLotHolders(ctx context.Context, repo basicFinder, candidates []model.MatchedResult, category model.Category, num1, num2 string) ([]model.MatchedResult, error) {
	var holders []model.MatchedResult
	bestHeld := 0
	for i := range candidates {
		// One machiaza appears as consecutive rows, one per rsdt_addr_flg.
		if i > 0 && !spansMachiaza(candidates[i-1:i+1]) {
			continue
		}
		held, err := lotHeld(ctx, repo, &candidates[i], category, num1, num2)
		if err != nil {
			return nil, err
		}
		switch {
		case held == 0 || held < bestHeld:
		case held > bestHeld:
			bestHeld = held
			holders = append(holders[:0], candidates[i])
		default:
			holders = append(holders, candidates[i])
		}
	}
	return holders, nil
}

// lotHeld returns how much of the lot num1-num2 the candidate holds, or 0 for none.
// Parcels and residential numbers are looked up only when the candidate has them,
// so a cache built without either category is never queried for it.
func lotHeld(ctx context.Context, repo basicFinder, c *model.MatchedResult, category model.Category, num1, num2 string) (int, error) {
	lgCode, machiazaID, ok := machiazaKey(c)
	if !ok {
		return 0, nil
	}
	lookups := []struct {
		count         int
		otherCategory model.Category // the category that never matches this table
		match         func(ctx context.Context, lgCode, machiazaID, first, second string) (repository.LotMatch, error)
		partial       int
	}{
		{c.Machiaza.ParcelCount, model.CategoryResidential, repo.ParcelLotMatch, lotHeldPrcNum1},
		{c.Machiaza.RsdtdspCount, model.CategoryParcel, repo.ResidentialLotMatch, lotHeldBlock},
	}
	held := 0
	for _, l := range lookups {
		if l.count == 0 || category == l.otherCategory {
			continue
		}
		match, err := l.match(ctx, lgCode, machiazaID, num1, num2)
		if err != nil {
			return 0, err
		}
		if match == repository.LotMatchWhole {
			return lotHeldWhole, nil
		}
		if match == repository.LotMatchFirst {
			held = l.partial
		}
	}
	return held, nil
}

// lotQuery is the number section following a machiaza name in the input,
// with the category the address is matched in.
type lotQuery struct {
	numbers  string
	category model.Category
}

// splitLot returns the first two components of the number section following a machiaza name.
// For example, "295-48" gives "295" and "48", and "6-ロ" gives "6" and "ロ".
func splitLot(numbers string) (num1, num2 string) {
	parts, _, _ := parseNumbersAndBuilding(numbers)
	if len(parts) == 0 {
		return "", ""
	}
	num1 = numberComponent(parts[0], false)
	if num1 != "" && len(parts) > 1 {
		num2 = numberComponent(parts[1], true)
	}
	return num1, num2
}

// spansMachiaza reports whether results come from more than one machiaza.
// One machiaza can appear twice, once per rsdt_addr_flg.
func spansMachiaza(results []model.MatchedResult) bool {
	first := &results[0].IDs
	for i := 1; i < len(results); i++ {
		ids := &results[i].IDs
		if derefString(ids.LgCode) != derefString(first.LgCode) || derefString(ids.MachiazaID) != derefString(first.MachiazaID) {
			return true
		}
	}
	return false
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
