package transform

import (
	_ "embed"
	"fmt"
	"strings"
)

// Character normalization that complements NFKC normalization. Handles
// characters and patterns that NFKC does not process.

// specialCharsData holds the replacement pairs. Each data line is
// "from<TAB>to" with an optional "<TAB># comment"; '#' lines and blank lines
// are ignored. The line order defines the strings.Replacer registration
// order, which decides which pattern wins when several match at the same
// position.
//
//go:embed special_chars.tsv
var specialCharsData string

var specialCharReplacer = strings.NewReplacer(parseSpecialCharPairs(specialCharsData)...)

// parseSpecialCharPairs parses the TSV data into a flat from/to list in file
// order. Lines are stripped of a trailing \r so a CRLF checkout parses
// identically to an LF one.
func parseSpecialCharPairs(data string) []string {
	var pairs []string
	for i, line := range strings.Split(data, "\n") {
		line = strings.TrimSuffix(line, "\r")
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		fields := strings.Split(line, "\t")
		ok := len(fields) == 2 || (len(fields) == 3 && strings.HasPrefix(fields[2], "#"))
		if !ok || fields[0] == "" || fields[1] == "" {
			panic(fmt.Sprintf("special_chars.tsv line %d: want from<TAB>to[<TAB># comment], got %q", i+1, line))
		}
		pairs = append(pairs, fields[0], fields[1])
	}
	return pairs
}

// StandardizeSpecialChars converts special characters and variant kanji (異体字) used in addresses.
func StandardizeSpecialChars(s string) (string, bool) {
	result := specialCharReplacer.Replace(s)
	return result, result != s
}
