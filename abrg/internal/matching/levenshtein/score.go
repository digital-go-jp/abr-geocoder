// Package levenshtein provides fuzzy address matching using Levenshtein distance.
// This file contains score calculation functions.
package levenshtein

import "math"

// Score calculation constants.
const (
	// maxFuzzyMatchScore is the maximum score for fuzzy matches (less than perfect).
	maxFuzzyMatchScore = 0.999

	// scoreRoundingFactor is the factor used to round scores to 2 decimal places.
	scoreRoundingFactor = 100
)

// calculateEditDistanceScore calculates the score based on edit distance.
// Perfect matches (editDist=0) get 1.0, fuzzy matches are capped at maxFuzzyMatchScore.
func calculateEditDistanceScore(editDist, addressLen int) float64 {
	if addressLen == 0 || editDist == 0 {
		return 1.0
	}
	score := 1.0 - (float64(editDist) / float64(addressLen))
	if score < 0 {
		score = 0
	}
	score = math.Round(score*scoreRoundingFactor) / scoreRoundingFactor

	// Rounding can push score to 1.0 even when editDist > 0; cap at maxFuzzyMatchScore.
	if score >= 1.0 {
		return maxFuzzyMatchScore
	}
	return score
}
