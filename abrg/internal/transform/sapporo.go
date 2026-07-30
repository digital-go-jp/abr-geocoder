package transform

import (
	"regexp"
	"strings"
)

// Sapporo address pattern: 北N西M or 南N東M etc.
// These are abbreviated forms of 北N条西M丁目 or 南N条東M丁目.
// A 丁目 the writer kept is part of the match so the expansion does not add a
// second one. A hyphen directly after the form is the chome boundary the
// abbreviation stands in for, so 丁目 replaces it rather than joining it.
// Example: 北3西1-2-5 -> 北3条西1丁目2-5
var sapporoJouPattern = regexp.MustCompile(`([北南])(\d+)([西東])(\d+)(?:丁目|-)?`)

// ExpandSapporoJou expands abbreviated Sapporo address patterns.
// Example: "北3西1-7" -> "北3条西1丁目:7".
// Only expands if 条 is missing (abbreviated form).
func ExpandSapporoJou(s string) (string, bool) {
	if !hasSapporoJouLead(s) {
		return s, false
	}

	result := sapporoJouPattern.ReplaceAllString(s, "${1}${2}条${3}${4}丁目")
	if result == s {
		return s, false
	}
	// AddColon skipped this string because the abbreviated form hid the chome
	// boundary. Now that the chome is spelled out, the boundary can be marked,
	// which is what every other chome address reaches matching with.
	result, _ = AddColon(result)
	return result, true
}

// hasSapporoJouLead reports whether the string can hold an abbreviated form:
// it must start a 北/南 run and must not already carry 条.
func hasSapporoJouLead(s string) bool {
	if strings.Contains(s, "条") {
		return false
	}
	return strings.Contains(s, "北") || strings.Contains(s, "南")
}
