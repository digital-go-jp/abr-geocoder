package repository

import (
	"log/slog"

	"abrg/internal/matchlevel"
	"abrg/internal/model"
)

// BuildIDs constructs model.IDs from already-converted fields.
// Invalid-length LgCode or MachiazaID values are treated as nil with a warning log.
func BuildIDs(lgCode, machiazaID string, rsdtAddrFlg *string) model.IDs {
	ids := model.IDs{RsdtAddrFlg: rsdtAddrFlg}
	if lgCode != "" {
		if len(lgCode) == model.LgCodeLength {
			ids.LgCode = &lgCode
		} else {
			slog.Warn("invalid lg_code length, treating as nil",
				"lg_code", lgCode, "length", len(lgCode), "expected", model.LgCodeLength)
		}
	}
	if machiazaID != "" {
		if len(machiazaID) == model.MachiazaIDLength {
			ids.MachiazaID = &machiazaID
		} else {
			slog.Warn("invalid machiaza_id length, treating as nil",
				"machiaza_id", machiazaID, "length", len(machiazaID), "expected", model.MachiazaIDLength)
		}
	}
	return ids
}

func coordsFromOpt(lon, lat *float64) []float64 {
	if lon != nil && lat != nil {
		return []float64{*lon, *lat}
	}
	return nil
}

// toNormalizedResult builds a MatchedResult from common components.
func toNormalizedResult(sa model.StructuredAddress, ids model.IDs, lon, lat *float64) model.MatchedResult {
	return model.MatchedResult{
		MatchedAddress:    model.FormatAddress(&sa),
		MatchLevel:        matchlevel.DetermineMatchLevel(&ids),
		Score:             1.0,
		IDs:               ids,
		StructuredAddress: sa,
		Coordinates:       coordsFromOpt(lon, lat),
	}
}

// basicSA builds a StructuredAddress from BasicResult's address fields.
func basicSA(br *BasicResult) model.StructuredAddress {
	return model.StructuredAddress{
		Pref: &br.Pref, County: br.County, City: &br.City, Ward: br.Ward,
		KyotoSt: br.KyotoSt, OazaCho: br.OazaCho, Chome: br.Chome,
		Koaza: br.Koaza, MachiazaDist: br.MachiazaDist,
	}
}

// basicIDs builds IDs from BasicResult's ID fields.
func basicIDs(br *BasicResult) model.IDs {
	return BuildIDs(br.LgCode, br.MachiazaID, br.RsdtAddrFlg)
}

// basicMachiaza builds the matcher's view of what the cache holds under a machiaza.
func basicMachiaza(br *BasicResult) model.MachiazaData {
	return model.MachiazaData{
		HasChome:     br.HasChome,
		ParcelCount:  br.ParcelCount,
		RsdtdspCount: br.RsdtdspCount,
	}
}

// BasicResultToPartialNormalized converts a BasicResult to a partial MatchedResult.
// Unlike BasicResultToNormalized, it does NOT set Score, MatchLevel, MatchedAddress, or
// UnmatchedAddress — those are computed by the levenshtein package using rune-based distance.
func BasicResultToPartialNormalized(br *BasicResult) model.MatchedResult {
	return model.MatchedResult{
		IDs:               basicIDs(br),
		StructuredAddress: basicSA(br),
		Coordinates:       coordsFromOpt(br.Lon, br.Lat),
		Machiaza:          basicMachiaza(br),
	}
}

// BasicResultToNormalized converts a BasicResult to model.MatchedResult.
func BasicResultToNormalized(br *BasicResult) model.MatchedResult {
	result := toNormalizedResult(basicSA(br), basicIDs(br), br.Lon, br.Lat)
	result.Machiaza = basicMachiaza(br)
	return result
}

// ResidentialResultToNormalized converts a ResidentialResult to model.MatchedResult.
func ResidentialResultToNormalized(rr *ResidentialResult) model.MatchedResult {
	sa := model.StructuredAddress{
		BlkNum:   rr.BlkNum,
		RsdtNum:  rr.RsdtNum,
		RsdtNum2: rr.RsdtNum2,
	}
	ids := model.IDs{
		LgCode:     rr.LgCode,
		MachiazaID: rr.MachiazaID,
		BlkID:      rr.BlkID,
		RsdtID:     rr.RsdtID,
		Rsdt2ID:    rr.Rsdt2ID,
	}
	return toNormalizedResult(sa, ids, rr.Lon, rr.Lat)
}

// ParcelResultToNormalized converts a ParcelResult to model.MatchedResult.
func ParcelResultToNormalized(pr *ParcelResult) model.MatchedResult {
	sa := model.StructuredAddress{
		PrcNum1: pr.PrcNum1,
		PrcNum2: pr.PrcNum2,
		PrcNum3: pr.PrcNum3,
	}
	ids := model.IDs{
		LgCode:     pr.LgCode,
		MachiazaID: pr.MachiazaID,
		PrcID:      pr.PrcID,
	}
	return toNormalizedResult(sa, ids, pr.Lon, pr.Lat)
}
