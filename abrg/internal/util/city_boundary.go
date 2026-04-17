package util

import "unicode/utf8"

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
