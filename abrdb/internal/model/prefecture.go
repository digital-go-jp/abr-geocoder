package model

import "slices"

// allPrefectureCodes holds precomputed list of prefecture codes 1..47.
var allPrefectureCodes = func() []int {
	codes := make([]int, 47)
	for i := range codes {
		codes[i] = i + 1
	}
	return codes
}()

func AllPrefectureCodes() []int {
	return slices.Clone(allPrefectureCodes)
}
