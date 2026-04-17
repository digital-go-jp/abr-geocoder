// Package normalize provides basic text normalization functions for address processing.
// It includes functions for removing quotes, variation selectors (SVS/IVS),
// comments, normalizing whitespace, NFKC normalization, and dash standardization.
//
// The main entry point is BasicNormalize, which applies all common normalizations
// in the correct order and returns a reusable result for downstream processing.
package normalize

// TransformStep is a function that transforms a string and reports whether it changed.
type TransformStep func(string) (string, bool)

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

// Adapt wraps a func(string) string as a TransformStep by comparing input and output.
func Adapt(fn func(string) string) TransformStep {
	return func(s string) (string, bool) {
		result := fn(s)
		return result, result != s
	}
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
