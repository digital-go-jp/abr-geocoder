package matching

import (
	"context"
	"strings"

	"abrg/internal/char"
	"abrg/internal/model"
	"abrg/internal/transform"
)

// detectBasicResultsWithBasic detects basic-level results using NormalizeBasicNormalized output.
// The normalizedAddr should be from normalize.NormalizeBasicNormalized().
func (n *Impl) detectBasicResultsWithBasic(ctx context.Context, normalizedAddr, pref string) (string, string, []model.MatchedResult, error) {
	searchAddr, _, _ := strings.Cut(normalizedAddr, " ")

	// Apply variant kanji normalization (e.g., "沖繩" -> "沖縄", "ヶ/ケ" -> "ガ")
	searchAddr, _ = transform.StandardizeSpecialChars(searchAddr)

	// Detect and remove prefecture BEFORE TransformText (avoids "三重県" -> "3重県")
	searchAddr, pref = n.detectAndRemovePrefecture(searchAddr, pref)

	// Transform address to add colon separator (e.g., "吉祥寺本町1-1-10" -> "吉祥寺本町:1-1-10")
	searchAddrWithColon, _ := transform.TextForBasicNormalized(searchAddr)

	searchAddrBase, afterColon, hasColon := strings.Cut(searchAddrWithColon, ":")

	// First try: search with base address (before colon)
	basicResults, modifiedSearchAddr, err := detectMachiaza(ctx, n.repo, searchAddrBase, pref, normalizedAddr)
	if err != nil {
		return pref, searchAddrWithColon, nil, err
	}
	if len(basicResults) > 0 {
		selectedAddr := selectSearchAddr(searchAddrWithColon, modifiedSearchAddr, hasColon)
		return pref, selectedAddr, basicResults, nil
	}

	// Second try: if afterColon starts with a digit, try searching with chome included
	if hasColon && len(afterColon) > 0 && char.IsASCIIDigit(afterColon[0]) {
		basicResults, modifiedSearchAddr, err := detectMachiaza(ctx, n.repo, searchAddrWithColon, pref, normalizedAddr)
		if err != nil {
			return pref, searchAddrWithColon, nil, err
		}
		if len(basicResults) > 0 {
			if modifiedSearchAddr != "" && strings.Contains(modifiedSearchAddr, "@") {
				return pref, modifiedSearchAddr, basicResults, nil
			}
			return pref, searchAddrWithColon, basicResults, nil
		}
	}

	// No match found
	return pref, searchAddrWithColon, nil, nil
}

// selectSearchAddr chooses between searchAddrWithColon and modifiedSearchAddr.
// modifiedSearchAddr is preferred when it contains colon notation that DetectMachiaza found.
func selectSearchAddr(searchAddrWithColon, modifiedSearchAddr string, hasColon bool) string {
	if modifiedSearchAddr == "" || (!strings.Contains(modifiedSearchAddr, ":") && !strings.Contains(modifiedSearchAddr, "@")) {
		return searchAddrWithColon
	}
	// Use modifiedSearchAddr if original had no colon, or for sen-go pattern
	if !hasColon || transform.IsSenGoPattern(modifiedSearchAddr) {
		return modifiedSearchAddr
	}
	return searchAddrWithColon
}

// detectAndRemovePrefecture detects prefecture from address and updates pref if needed.
// Returns the address with prefecture removed and the updated pref code.
func (n *Impl) detectAndRemovePrefecture(searchAddr, pref string) (string, string) {
	needsPrefDetection := pref == model.All || pref == ""

	if prefCode := detectPrefectureCode(searchAddr); prefCode != "" {
		searchAddr = removePrefectureFromAddress(searchAddr, prefCode)
		if needsPrefDetection {
			pref = prefCode
		}
	} else if needsPrefDetection {
		// Try to detect from city name (e.g., "京都市下京区..." -> "26")
		if cityPrefCode := n.detectCityPrefectureCode(searchAddr); cityPrefCode != "" {
			pref = cityPrefCode
		}
	}
	return searchAddr, pref
}

// detectLgCode detects lg_code from city+ward in the search address.
// Returns the lg_code if found, empty string otherwise.
func (n *Impl) detectLgCode(searchAddr string) string {
	if n.cityWardLgCodes == nil {
		return ""
	}

	cityEndIdx := n.cityBoundary.Find(searchAddr)
	if cityEndIdx <= 0 {
		return ""
	}

	cityWard := searchAddr[:cityEndIdx]
	if lgCode, ok := n.cityWardLgCodes[cityWard]; ok {
		return lgCode
	}

	return ""
}

// detectCityPrefectureCode detects prefecture code from city name using prefix map lookup.
func (n *Impl) detectCityPrefectureCode(address string) string {
	return n.cityPrefixMap.lookup(address)
}
