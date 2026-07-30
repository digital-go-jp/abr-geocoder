// Package normalize provides basic text normalization functions for address processing.
// It includes functions for removing quotes, variation selectors (SVS/IVS),
// comments, normalizing whitespace, NFKC normalization, and dash standardization.
//
// The main entry point is BasicNormalize, which applies all common normalizations
// in the correct order and returns a reusable result for downstream processing.
package normalize

import "regexp"

// TransformStep is a function that transforms a string and reports whether it changed.
type TransformStep func(string) (string, bool)

// ReplaceRule pairs a pattern with its replacement. Rules in a table apply
// in declaration order; the order is part of the normalization spec.
type ReplaceRule struct {
	Re   *regexp.Regexp
	Repl string
}

// applyRules applies every rule to s in order.
func applyRules(s string, rules []ReplaceRule) string {
	for _, r := range rules {
		s = r.Re.ReplaceAllString(s, r.Repl)
	}
	return s
}

// ApplyFirstMatch applies the first rule that changes s and reports whether
// any rule matched.
func ApplyFirstMatch(s string, rules []ReplaceRule) (string, bool) {
	for _, r := range rules {
		if next := r.Re.ReplaceAllString(s, r.Repl); next != s {
			return next, true
		}
	}
	return s, false
}

func ApplySteps(s string, steps []TransformStep) (string, bool) {
	var changed bool
	for _, step := range steps {
		if result, wasChanged := step(s); wasChanged {
			s = result
			changed = true
		}
	}
	return s, changed
}

var basicNormalizeSteps = []TransformStep{
	removeQuotes,
	removeVS,
	NormalizeSpaces,
	removeComments,
	NFKCNormalize,
	NormalizeDashes,
}

// Result is reused by both standardize and transform, avoiding redundant processing.
func BasicNormalize(s string) string {
	if s == "" {
		return s
	}
	text, _ := ApplySteps(s, basicNormalizeSteps)
	return text
}
