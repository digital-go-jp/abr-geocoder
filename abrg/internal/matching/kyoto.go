package matching

// Kyoto-specific address pattern handling.
// Kyoto uses unique street name patterns (通り名) like "寺町通御池上る".

import (
	"strings"

	"abrg/internal/model"
)

// mergeKyotoStToResults adds kyoto_st from basicResults to dest results.
// Parcel/rsdtdsp data doesn't include kyoto_st, so we need to merge it from basic results.
// Also updates machiaza_id and rsdt_addr_flg to use basic's values (with kyoto_st detail).
func mergeKyotoStToResults(destResults []model.MatchedResult, basicResults []model.MatchedResult) {
	if len(basicResults) == 0 || basicResults[0].StructuredAddress.KyotoSt == nil {
		return
	}

	basic := &basicResults[0]
	for i := range destResults {
		if destResults[i].StructuredAddress.KyotoSt == nil {
			destResults[i].StructuredAddress.KyotoSt = basic.StructuredAddress.KyotoSt

			// Within the same lg_code, basic's machiaza_id identifies the
			// street-level entry while the parcel row only reaches the town,
			// so basic's is the more specific of the two.
			if basic.IDs.MachiazaID != nil {
				destResults[i].IDs.MachiazaID = basic.IDs.MachiazaID
			}

			if basic.IDs.RsdtAddrFlg != nil {
				destResults[i].IDs.RsdtAddrFlg = basic.IDs.RsdtAddrFlg
			}

			destResults[i].MatchedAddress = model.FormatAddress(&destResults[i].StructuredAddress)
		}
	}
}

// buildSearchAddrWithoutKyotoSt builds searchAddr for parcel/rsdtdsp searches from structured_address.
// Excludes kyoto_st since parcel/rsdtdsp data doesn't include it.
// e.g., structured_address with kyoto_st="寺町通御池上る" -> "京都市中京区上本能寺前町:488"
func buildSearchAddrWithoutKyotoSt(sa *model.StructuredAddress, afterColon string) string {
	var b strings.Builder
	if sa.City != nil {
		b.WriteString(*sa.City)
	}
	if sa.Ward != nil {
		b.WriteString(*sa.Ward)
	}
	// Skip kyoto_st
	if sa.OazaCho != nil {
		b.WriteString(*sa.OazaCho)
	}
	if sa.Chome != nil {
		b.WriteString(*sa.Chome)
	}
	if sa.Koaza != nil {
		b.WriteString(*sa.Koaza)
	}
	if afterColon != "" {
		b.WriteByte(':')
		b.WriteString(afterColon)
	}
	return b.String()
}
