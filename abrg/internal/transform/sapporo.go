package transform

import (
	"regexp"
	"strings"
)

// Sapporo address pattern: 北N西M or 南N東M etc.
// These are abbreviated forms of 北N条西M丁目 or 南N条東M丁目
// Pattern: (北|南)(数字)(西|東)(数字)
// Example: 北3西1 -> 北3条西1丁目
var sapporoJouPattern = regexp.MustCompile(`([北南])(\d+)([西東])(\d+)`)

// ExpandSapporoJou expands abbreviated Sapporo address patterns.
// Example: "北3西1-7" -> "北3条西1丁目-7".
// Only expands if both 条 and 丁目 are missing (abbreviated form).
func ExpandSapporoJou(s string) (string, bool) {
	if !hasSapporoJouLead(s) {
		return s, false
	}

	result := sapporoJouPattern.ReplaceAllString(s, "${1}${2}条${3}${4}丁目")
	return result, result != s
}

// hasSapporoJouLead reports whether the string can hold an abbreviated form:
// it must start a 北/南 run and must not already carry 条.
func hasSapporoJouLead(s string) bool {
	if strings.Contains(s, "条") {
		return false
	}
	return strings.Contains(s, "北") || strings.Contains(s, "南")
}
