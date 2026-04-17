package normalize

import (
	"strings"

	"abrg/internal/model"
)

// NormalizeAddressText standardizes the given address string with minimal transformations
// and detects the address type.
// This function is for user-facing output (API responses).
func NormalizeAddressText(s string) (string, model.NormalizeCategory) {
	return NormalizeAddressTextWithBasic(s, nil)
}

// NormalizeAddressTextWithBasic standardizes the address using pre-computed BasicNormalize result.
// If basicNormalized is nil, BasicNormalize will be called on s internally.
// If basicNormalized is provided, its value is used and s is ignored.
// This allows reusing BasicNormalize result across standardize and transform pipelines.
func NormalizeAddressTextWithBasic(s string, basicNormalized *string) (string, model.NormalizeCategory) {
	if basicNormalized != nil {
		s = *basicNormalized
	} else {
		s = BasicNormalize(s)
	}

	addressPart, parenthesesPart, hasParentheses := strings.Cut(s, "(")
	if hasParentheses {
		s = addressPart
	}

	addressType := detectAddressType(s)

	// Apply address-type-specific formatting, then standardize spaces.
	s = applyAddressFormatting(s, addressType)
	s, _ = NormalizeSpaces(s)

	if hasParentheses {
		s = strings.TrimSpace(s) + " (" + parenthesesPart
	}

	s, _ = addSpacesAroundPunctuation(s)

	// Note: addSpacesAroundPunctuation now handles consecutive spaces internally,
	// so a second NormalizeSpaces call is no longer needed.

	s = strings.TrimSpace(s)

	return s, addressType
}

// applyAddressFormatting applies address number formatting based on the detected address type.
// It tries AddressNumbersToHyphen first; if that doesn't apply, it falls back
// to increasingly lenient space-insertion steps depending on the address type.
func applyAddressFormatting(s string, addressType model.NormalizeCategory) string {
	switch addressType {
	case model.NormalizeCategoryUndetermined, model.NormalizeCategoryUnknown:
		// Try AddressNumbersToHyphen first; if it changes the input, use that result.
		if result, changed := AddressNumbersToHyphen(s); changed {
			return result
		}
		// Fall back to space-insertion steps.
		if result, changed := addSpaceAfterFirstArabicNumber(s); changed {
			return result
		}
		if addressType == model.NormalizeCategoryUnknown {
			if result, changed := addSpaceAfterNumberBeforeJapanese(s); changed {
				return result
			}
		}
		return s
	default:
		result, _ := AddressNumbersToHyphen(s)
		return result
	}
}
