package normalize

import "strings"

// -----------------------------------------------------------------------------
// Variation Selector removal (SVS + IVS)
// 異体字セレクタの除去
// -----------------------------------------------------------------------------

// This handles:
//   - SVS: U+FE00-U+FE0F (Standardized Variation Sequence)
//   - IVS: U+E0100-U+E01EF (Ideographic Variation Sequence)
//
// These invisible characters specify glyph variants and can interfere with
// address matching (e.g., "愛媛󠄃県" with U+E0103 after "媛" won't match "愛媛県").
func removeVS(s string) (string, bool) {
	var result strings.Builder
	result.Grow(len(s))
	changed := false

	for _, r := range s {
		if (r >= 0xFE00 && r <= 0xFE0F) || (r >= 0xE0100 && r <= 0xE01EF) {
			changed = true
			continue
		}
		result.WriteRune(r)
	}

	if !changed {
		return s, false
	}
	return result.String(), true
}
