// Package normalize normalizes the characters of an address before matching.
// The main entry point is BasicNormalize.
package normalize

import "regexp"

// TransformStep is a function that transforms a string and reports whether it changed.
type TransformStep func(string) (string, bool)

// ReplaceRule pairs a pattern with its replacement.
// Rules in a table apply in declaration order.
// The order is part of the normalization spec.
type ReplaceRule struct {
	Re   *regexp.Regexp
	Repl string
}

func applyRules(s string, rules []ReplaceRule) string {
	for _, r := range rules {
		s = r.Re.ReplaceAllString(s, r.Repl)
	}
	return s
}

// ApplyFirstMatch applies the first rule that changes s and reports whether any rule matched.
func ApplyFirstMatch(s string, rules []ReplaceRule) (string, bool) {
	for _, r := range rules {
		if next := r.Re.ReplaceAllString(s, r.Repl); next != s {
			return next, true
		}
	}
	return s, false
}

// ApplySteps applies steps to s in order and reports whether any step changed it.
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

// basicNormalizeSteps runs RemoveDefaultIgnorable first so that removeQuotes sees a quote that follows a BOM.
var basicNormalizeSteps = []TransformStep{
	RemoveDefaultIgnorable,
	removeQuotes,
	NormalizeSpaces,
	removeComments,
	NFKCNormalize,
	NormalizeDashes,
}

// BasicNormalize removes invisible characters, surrounding quotes and // or /* */ comments from s,
// collapses whitespace, and applies NFKC and dash normalization.
func BasicNormalize(s string) string {
	if s == "" {
		return s
	}
	text, _ := ApplySteps(s, basicNormalizeSteps)
	return text
}
