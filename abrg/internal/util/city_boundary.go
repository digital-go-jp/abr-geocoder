package util

import "unicode/utf8"

// CityBoundary resolves the city/ward boundary of an address by longest-prefix
// match against the set of known city names, falling back to FindCityBoundary's
// heuristic when no known city name is a prefix of the address.
//
// The dictionary match is what distinguishes cities whose name contains a 市/町/村
// mid-string (市川市, 町田市, 東村山市): the heuristic alone cuts at the first marker,
// but the dictionary knows 市川市 is a city while 市川 is not.
type CityBoundary struct {
	set      map[string]struct{}
	maxRunes int
}

// NewCityBoundary builds a matcher from city-boundary strings such as "市川市",
// "大阪市天王寺区" and "遠田郡涌谷町" (city+ward and county+city+ward forms).
func NewCityBoundary(cityStrings []string) *CityBoundary {
	b := &CityBoundary{set: make(map[string]struct{}, len(cityStrings))}
	for _, s := range cityStrings {
		if s == "" {
			continue
		}
		b.set[s] = struct{}{}
		if n := utf8.RuneCountInString(s); n > b.maxRunes {
			b.maxRunes = n
		}
	}
	return b
}

// Find returns the byte index immediately after the city boundary in addr.
// It prefers the longest known city name that is a prefix of addr; if none
// matches (or the matcher is nil/empty) it falls back to the FindCityBoundary
// heuristic, preserving behavior for ward-only and prefecture-prefixed inputs.
func (b *CityBoundary) Find(addr string) int {
	if b != nil && len(b.set) > 0 {
		runes := []rune(addr)
		limit := min(b.maxRunes, len(runes))
		for l := limit; l > 0; l-- {
			prefix := string(runes[:l])
			if _, ok := b.set[prefix]; ok {
				return len(prefix)
			}
		}
	}
	return FindCityBoundary(addr)
}

// isCityMarker reports whether ch is a Japanese city/ward/town/village suffix character.
func isCityMarker(ch rune) bool {
	return ch == '区' || ch == '市' || ch == '町' || ch == '村'
}

// FindCityBoundary finds the byte index immediately after the city/ward boundary in addr.
//
//	e.g., "大阪市天王寺区烏ヶ辻町" -> index after "区"
func FindCityBoundary(addr string) int {
	cityEndIdx := -1
	for i, ch := range addr {
		if !isCityMarker(ch) {
			continue
		}
		cityEndIdx = i + len(string(ch))
		// For 区, this is the definitive boundary
		if ch == '区' {
			break
		}
		// Handle adjacent city markers (e.g., "田村市" → 村 then immediate 市)
		// When a marker is immediately followed by another marker,
		// the second one is the actual city suffix
		if cityEndIdx < len(addr) {
			nextCh, nextSize := utf8.DecodeRuneInString(addr[cityEndIdx:])
			if isCityMarker(nextCh) {
				cityEndIdx += nextSize
				if nextCh == '区' {
					break
				}
			}
		}
		// For 市/町/村, check if there's a 区 later (e.g., "大阪市天王寺区")
		remaining := addr[cityEndIdx:]
		for j, ch2 := range remaining {
			if ch2 == '区' {
				cityEndIdx = cityEndIdx + j + len(string(ch2))
				break
			}
		}
		break
	}
	return cityEndIdx
}
