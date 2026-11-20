package matching

// Kyoto-specific address pattern handling.
// Kyoto uses unique street name patterns (通り名) like "寺町通御池上る".

import (
	"strings"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

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
