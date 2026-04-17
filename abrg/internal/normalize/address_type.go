package normalize

import (
	"regexp"
	"strings"

	"abrg/internal/model"
)

// Address type detection patterns grouped by category.
var (
	// Invalid/Ambiguous patterns - N番地N号 format is incorrect (mixes parcel and residential)
	patternBanchiGo = regexp.MustCompile(`\d+番地\d+(?:-\d+)*号`)

	// Residential patterns - N番N号 format with optional hyphenated suffixes
	patternBanGo   = regexp.MustCompile(`\d+番\d+(?:-[A-Za-z0-9]+)*号`)
	patternBan     = regexp.MustCompile(`\d+番\d+$`)
	patternBanOnly = regexp.MustCompile(`\d+番$`)

	// Parcel patterns - 番地 format
	patternBanchi = regexp.MustCompile(`\d+番地`)

	// Ambiguous pattern - N-N format cannot determine type
	patternArabicDash = regexp.MustCompile(`\d+-\d+`)
)

// detectAddressType detects address type from address string.
// Returns NormalizeCategoryResidential for residential addresses (住居表示),
// NormalizeCategoryParcel for parcel addresses (地番),
// or NormalizeCategoryUnknown if pattern cannot be determined.
func detectAddressType(address string) model.NormalizeCategory {
	// Use only the first part (before space) for detection
	if before, _, found := strings.Cut(address, " "); found {
		address = before
	}

	// Check for invalid pattern first - N番地N号 mixes parcel and residential formats
	if patternBanchiGo.MatchString(address) {
		return model.NormalizeCategoryUndetermined
	}

	// Residential pattern - N番N号 with optional hyphenated suffixes
	if patternBanGo.MatchString(address) {
		return model.NormalizeCategoryResidential
	}

	// Ambiguous patterns - cannot determine type without 号 suffix
	if patternBan.MatchString(address) || patternBanOnly.MatchString(address) {
		return model.NormalizeCategoryUndetermined
	}

	// Parcel pattern - 番地 format
	if patternBanchi.MatchString(address) {
		return model.NormalizeCategoryParcel
	}

	// Arabic dash pattern (1-2-3) - cannot determine type
	if patternArabicDash.MatchString(address) {
		return model.NormalizeCategoryUndetermined
	}

	return model.NormalizeCategoryUnknown
}
