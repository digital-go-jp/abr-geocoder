// Package matchlevel provides functions to determine address match levels from ID fields.
package matchlevel

import "abrg/internal/model"

// DetermineMatchLevel determines the match level using ID fields.
// Invariant: MachiazaID and LgCode are either nil or valid length (enforced by repository.buildIDs).
func DetermineMatchLevel(ids *model.IDs) model.MatchLevel {
	if ids == nil {
		return model.MatchLevelUnknown
	}

	if ids.PrcID != nil {
		return model.MatchLevelParcel
	}
	if ids.RsdtID != nil {
		return model.MatchLevelResidentialDetail
	}
	if ids.BlkID != nil {
		return model.MatchLevelResidentialBlock
	}

	// Machiaza: suffix "000" = base level, otherwise detail level.
	if ids.MachiazaID != nil {
		suffix := (*ids.MachiazaID)[model.MachiazaBaseLength:model.MachiazaIDLength]
		if suffix != model.BaseMachiazaSuffix {
			return model.MatchLevelMachiazaDetail
		}
		return model.MatchLevelMachiaza
	}

	// LgCode: suffix "000" = prefecture level, otherwise city level.
	// Extract positions [2:5] from lg_code (e.g., "130001" -> "000", "131016" -> "101")
	if ids.LgCode != nil {
		suffix := (*ids.LgCode)[model.LgCodePrefLength:model.LgCodeCitySuffixEnd]
		if suffix != model.BaseCitySuffix {
			return model.MatchLevelCity
		}
		return model.MatchLevelPrefecture
	}

	return model.MatchLevelUnknown
}
