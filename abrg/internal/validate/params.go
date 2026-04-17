package validate

import (
	"fmt"
	"strings"

	"abr.local/common/validate"

	"abrg/internal/model"
)

// categoryCompatible checks if the requested category is compatible with enabledCategory.
func categoryCompatible(category, enabledCategory string) error {
	switch category {
	case string(model.CategoryAll):
		if enabledCategory != model.All {
			return fmt.Errorf("category 'all' requires enabled_category to be 'all'")
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

// ValidateCategory validates category parameter and returns default if empty.
func ValidateCategory(categoryStr, enabledCategory string) (model.Category, error) {
	if categoryStr == "" {
		categoryStr = enabledCategory
	}

	category := model.Category(categoryStr)
	if err := categoryCompatible(categoryStr, enabledCategory); err != nil {
		return category, err
	}

	return category, nil
}

// ValidatePref validates pref parameter and returns default if empty.
func ValidatePref(prefStr, enabledPref string) (string, error) {
	if prefStr == "" {
		prefStr = enabledPref
	}

	// Validate prefecture code range if numeric (skip validation for "all")
	if strings.ToLower(strings.TrimSpace(prefStr)) != model.All {
		if _, err := validate.ParsePrefectureCode(prefStr); err != nil {
			return "", fmt.Errorf("invalid pref: %w", err)
		}
	}

	// Validate against enabled_pref
	if prefStr != enabledPref && enabledPref != model.All {
		return "", fmt.Errorf("invalid pref: must match enabled_pref '%s'", enabledPref)
	}

	return prefStr, nil
}
