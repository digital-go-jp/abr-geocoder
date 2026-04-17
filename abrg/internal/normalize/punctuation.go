package normalize

import "strings"

// addSpacesAroundPunctuation adds spaces around parentheses and before commas and Japanese commas.
// It also normalizes consecutive spaces to avoid the need for a separate NormalizeSpaces call.
func addSpacesAroundPunctuation(s string) (string, bool) {
	if !strings.ContainsAny(s, "(),、") {
		return s, false
	}

	var b strings.Builder
	b.Grow(len(s) + 10)

	prevSpace := true // Treat start as space to avoid leading space
	for _, r := range s {
		switch r {
		case '(':
			if !prevSpace {
				b.WriteByte(' ')
			}
			b.WriteRune(r)
			prevSpace = false
		case ')':
			b.WriteRune(r)
			b.WriteByte(' ')
			prevSpace = true
		case ',', '、':
			if !prevSpace {
				b.WriteByte(' ')
			}
			b.WriteRune(r)
			prevSpace = false
		case ' ':
			if !prevSpace {
				b.WriteByte(' ')
				prevSpace = true
			}
			// Skip consecutive spaces
		default:
			b.WriteRune(r)
			prevSpace = false
		}
	}

	result := strings.TrimRight(b.String(), " ")
	return result, result != s
}
