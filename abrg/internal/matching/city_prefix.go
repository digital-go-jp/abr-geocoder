package matching

import (
	"strings"
	"unicode/utf8"
)

// cityPrefixEntry holds a city name and its prefecture code.
type cityPrefixEntry struct {
	city string
	code string
}

// cityPrefixMap maps the first 2 runes of city names to entries for O(1) average lookup.
type cityPrefixMap map[string][]cityPrefixEntry

func buildCityPrefixMap(cityPrefCodes map[string]string) cityPrefixMap {
	if len(cityPrefCodes) == 0 {
		return nil
	}
	m := make(cityPrefixMap, len(cityPrefCodes)/10)
	for city, code := range cityPrefCodes {
		key := firstTwoRunes(city)
		if key == "" {
			continue
		}
		m[key] = append(m[key], cityPrefixEntry{city: city, code: code})
	}
	return m
}

// firstTwoRunes returns the prefix of s covering its first two runes,
// or "" if s has fewer than two.
func firstTwoRunes(s string) string {
	_, size1 := utf8.DecodeRuneInString(s)
	_, size2 := utf8.DecodeRuneInString(s[size1:])
	if size2 == 0 {
		return ""
	}
	return s[:size1+size2]
}

// lookup finds the prefecture code for an address by checking city name prefixes.
func (m cityPrefixMap) lookup(address string) string {
	if m == nil {
		return ""
	}
	key := firstTwoRunes(address)
	if key == "" {
		return ""
	}
	for _, e := range m[key] {
		if strings.HasPrefix(address, e.city) {
			return e.code
		}
	}
	return ""
}
