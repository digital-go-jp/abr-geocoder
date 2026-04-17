// Package transform provides text transformation functions for address normalization.
package transform

import (
	"regexp"
	"strings"
)

// chomePattern matches arabic number followed by 丁目 for conversion to @ notation.
var chomePattern = regexp.MustCompile(`(\d+)丁目`)

// ChomeToSymbol converts chome patterns to @ symbol notation.
// Example: "栄町1丁目" -> "栄町1@".
func ChomeToSymbol(s string) string {
	// Fast check: if string doesn't contain "丁目", no need to process
	if !strings.Contains(s, "丁目") {
		return s
	}

	// Handle chome patterns: アラビア数字丁目 → 数字@
	return chomePattern.ReplaceAllString(s, "$1@")
}
