package normalize

import (
	"regexp"
	"strings"
)

var (
	// Pre-compiled regex patterns for comment removal
	blockComment = regexp.MustCompile(`/\*[^*]*\*+(?:[^/*][^*]*\*+)*/`) // /* ... */
	lineComment  = regexp.MustCompile(`//.*`)                           // // ...
)

// removeComments removes block comments (/* ... */) and line comments (// ...).
// Also trims trailing spaces left by comment removal.
func removeComments(s string) (string, bool) {
	result := s

	// Remove block comments first: /* some comment */
	result = blockComment.ReplaceAllString(result, "")

	// Remove line comments: // some comment
	result = lineComment.ReplaceAllString(result, "")

	// Trim trailing spaces left by comment removal
	// e.g., "addr /* comment */" -> "addr " -> "addr"
	result = strings.TrimRight(result, " ")

	return result, result != s
}
