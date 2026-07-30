package transform

import (
	"regexp"
	"strings"
)

// Sapporo address pattern: 北N西M or 南N東M etc.
// These are abbreviated forms of 北N条西M丁目 or 南N条東M丁目.
// Whichever boundary the writer used — a 丁目 they kept, or the hyphen the
// abbreviation puts in its place — is part of the match, so the expansion
// replaces it instead of adding a second one.
var sapporoJouPattern = regexp.MustCompile(`([北南])(\d+)([西東])(\d+)(?:丁目|-)?`)

// expandSapporoJou expands abbreviated Sapporo address patterns.
// Example: "北3西1-7" -> "北3条西1丁目:7".
// Only expands if 条 is missing (abbreviated form).
func expandSapporoJou(s string) (string, bool) {
	if !hasSapporoJouLead(s) {
		return s, false
	}

	result := sapporoJouPattern.ReplaceAllString(s, "${1}${2}条${3}${4}丁目")
	if result == s {
		return s, false
	}
	// The abbreviated form hid the chome boundary from AddColon; mark it now
	// that 丁目 is spelled out.
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
