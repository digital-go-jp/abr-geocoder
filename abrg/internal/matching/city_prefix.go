package matching

import "strings"

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
		runes := []rune(city)
		if len(runes) < 2 {
			continue
		}
		key := string(runes[:2])
		m[key] = append(m[key], cityPrefixEntry{city: city, code: code})
	}
	return m
}

// lookup finds the prefecture code for an address by checking city name prefixes.
func (m cityPrefixMap) lookup(address string) string {
	if m == nil {
		return ""
	}
	runes := []rune(address)
	if len(runes) < 2 {
		return ""
	}
	key := string(runes[:2])
	for _, e := range m[key] {
		if strings.HasPrefix(address, e.city) {
			return e.code
		}
	}
	return ""
}
