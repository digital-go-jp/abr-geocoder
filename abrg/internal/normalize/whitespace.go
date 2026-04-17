package normalize

import (
	"strings"
	"unicode"
)

// NormalizeSpaces normalizes spaces and returns whether a change was made.
func NormalizeSpaces(s string) (string, bool) {
	if s == "" {
		return s, false
	}

	var b strings.Builder
	b.Grow(len(s))

	inSpace := true // Start as true to skip leading spaces

	for _, r := range s {
		if unicode.IsSpace(r) {
			inSpace = true
		} else {
			if inSpace && b.Len() > 0 {
				b.WriteByte(' ')
			}
			b.WriteRune(r)
			inSpace = false
		}
	}

	result := b.String()
	return result, result != s
}
