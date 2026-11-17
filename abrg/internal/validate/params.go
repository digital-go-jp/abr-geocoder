package validate

import (
	"errors"
	"fmt"
	"strings"

	"github.com/digital-go-jp/abr-geocoder/common/validate"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// categoryCompatible checks if the requested category is compatible with enabledCategory.
func categoryCompatible(category, enabledCategory string) error {
	switch category {
	case string(model.CategoryAll):
		if enabledCategory != model.All {
			return errors.New("category 'all' requires enabled_category to be 'all'")
		}
	case string(model.CategoryBasic):
		// basic is compatible with any enabledCategory
	case string(model.CategoryResidential), string(model.CategoryParcel):
		if enabledCategory != model.All && enabledCategory != category {
			return fmt.Errorf("category '%s' requires enabled_category to be 'all' or '%s'", category, category)
		}
	default:
		return fmt.Errorf("invalid category: '%s'", category)
	}
	return nil
}

// validateCategory validates category parameter and returns default if empty.
func validateCategory(categoryStr, enabledCategory string) (model.Category, error) {
	if categoryStr == "" {
		categoryStr = enabledCategory
	}

	category := model.Category(categoryStr)
	if err := categoryCompatible(categoryStr, enabledCategory); err != nil {
		return category, err
	}

	return category, nil
}

// validatePref validates the pref parameter against enabledPref.
// It returns the pref with surrounding spaces removed, or enabledPref when pref is empty.
func validatePref(prefStr, enabledPref string) (string, error) {
	prefStr = strings.TrimSpace(prefStr)
	if prefStr == "" {
		prefStr = enabledPref
	}

	// Normalize the case of "all" so downstream comparisons against model.All work.
	if strings.ToLower(prefStr) == model.All {
		prefStr = model.All
	} else if _, err := validate.ParsePrefectureCode(prefStr); err != nil {
		return "", fmt.Errorf("invalid pref: %w", err)
	}

	if enabledPref != model.All && !samePref(prefStr, enabledPref) {
		return "", fmt.Errorf("invalid pref: must match enabled_pref '%s'", enabledPref)
	}

	return prefStr, nil
}

// samePref reports whether two pref values name the same prefecture.
// Codes are compared as numbers, so "01" and "1" are the same.
func samePref(a, b string) bool {
	codeA, errA := validate.ParsePrefectureCode(a)
	codeB, errB := validate.ParsePrefectureCode(b)
	if errA != nil || errB != nil {
		return a == b
	}
	return codeA == codeB
}

// ValidateOptions validates the category, pref and limit of a query against the cache configuration.
// It returns the category and pref to query with, falling back to the enabled values when they are empty.
func ValidateOptions(category, pref string, limit int, enabledCategory, enabledPref string) (model.Category, string, error) {
	resolvedCategory, err := validateCategory(category, enabledCategory)
	if err != nil {
		return "", "", err
	}

	resolvedPref, err := validatePref(pref, enabledPref)
	if err != nil {
		return "", "", err
	}

	if err := validateLimit(limit); err != nil {
		return "", "", err
	}

	return resolvedCategory, resolvedPref, nil
}

// MinLimit and MaxLimit bound the number of results a single query may return.
const (
	MinLimit = 1
	MaxLimit = 5
)

// validateLimit validates that limit is within the supported range.
func validateLimit(limit int) error {
	if limit < MinLimit || limit > MaxLimit {
		return fmt.Errorf("invalid limit '%d': must be between %d and %d", limit, MinLimit, MaxLimit)
	}
	return nil
}
