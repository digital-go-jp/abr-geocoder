package normalize

import (
	"strings"
	"unicode"
)

// NormalizeSpaces normalizes spaces and returns whether a change was made.
func NormalizeSpaces(s string) (string, bool) {
	if s == "" || !needsSpaceNormalization(s) {
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

// needsSpaceNormalization reports whether s differs from its normalized form:
// it has leading or trailing whitespace, a run of two or more whitespace
// characters, or a whitespace character other than the ASCII space.
func needsSpaceNormalization(s string) bool {
	inSpace := true // Start as true so leading spaces count as a change
	for _, r := range s {
		if !unicode.IsSpace(r) {
			inSpace = false
			continue
		}
		if inSpace || r != ' ' {
			return true
		}
		inSpace = true
	}
	return inSpace
}
