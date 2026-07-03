// Package model defines data structures for API requests and responses.
package model

import "strings"

type MatchLevel string

const (
	MatchLevelUnknown           MatchLevel = "unknown"
	MatchLevelPrefecture        MatchLevel = "pref"
	MatchLevelCity              MatchLevel = "city"
	MatchLevelMachiaza          MatchLevel = "machiaza"
	MatchLevelMachiazaDetail    MatchLevel = "machiaza_detail"
	MatchLevelResidentialBlock  MatchLevel = "rsdtdsp_blk"
	MatchLevelResidentialDetail MatchLevel = "rsdtdsp_rsdt"
	MatchLevelParcel            MatchLevel = "parcel"
)

// All is a common constant representing "all" for various filters.
const All = "all"

// MachiazaID constants
const (
	// UnknownMachiazaID represents an unknown machiaza (町字不明).
	UnknownMachiazaID = "0000000"
	// MachiazaIDLength is the standard length of a machiaza ID.
	MachiazaIDLength = 7
	// MachiazaBaseLength is the length of the base portion (first 4 digits).
	MachiazaBaseLength = 4
	// BaseMachiazaSuffix represents the suffix for base machiaza without chome ("000").
	BaseMachiazaSuffix = "000"
	// MaxChomeNumber is the maximum valid chome number per ABR specification.
	// ABR uses 001-100 for chome in the last 3 digits of machiaza_id.
	MaxChomeNumber = 100
)

// LgCode constants
// LgCode format: PPCCCX (6 digits, JIS X 0401 + JIS X 0402 + check digit)
//
// PP  = prefecture code (01-47)
// CCC = city/ward code (000 for prefecture-level)
// X   = check digit (modulus 11)
//
// Example: "131016" = Tokyo (13) + Chiyoda-ku (101) + check digit (6)
const (
	// LgCodeLength is the standard length of a local government code (6 digits).
	LgCodeLength = 6
	// LgCodePrefLength is the length of the prefecture portion (first 2 digits).
	LgCodePrefLength = 2
	// LgCodeCitySuffixEnd is the slice end index for extracting city suffix for base check.
	// Used to extract positions [2:5] (3 chars) to compare with BaseCitySuffix.
	LgCodeCitySuffixEnd = 5
	// BaseCitySuffix represents the suffix for prefecture-level records ("000").
	// Prefecture records have lg_code like "130001" where positions [2:5] = "000".
	BaseCitySuffix = "000"
)

type Category string

const (
	CategoryAll         Category = All
	CategoryBasic       Category = "basic" // Prefecture, City, and Machiaza levels
	CategoryResidential Category = "rsdtdsp"
	CategoryParcel      Category = "parcel"
)

type NormalizeCategory string

const (
	NormalizeCategoryResidential  NormalizeCategory = "rsdtdsp"
	NormalizeCategoryParcel       NormalizeCategory = "parcel"
	NormalizeCategoryUndetermined NormalizeCategory = "undetermined"
	NormalizeCategoryUnknown      NormalizeCategory = "unknown"
)

type IDs struct {
	LgCode      *string `json:"lg_code"`
	MachiazaID  *string `json:"machiaza_id"`
	RsdtAddrFlg *string `json:"rsdt_addr_flg"`
	BlkID       *string `json:"blk_id"`
	RsdtID      *string `json:"rsdt_id"`
	Rsdt2ID     *string `json:"rsdt2_id"`
	PrcID       *string `json:"prc_id"`
	// Internal metadata (not included in JSON output)
	HasChome     bool `json:"-"` // True if this oaza has chome variations
	ParcelCount  int  `json:"-"` // Number of parcel records for this machiaza
	RsdtdspCount int  `json:"-"` // Number of rsdtdsp records for this machiaza
}

type StructuredAddress struct {
	Pref         *string `json:"pref"`
	County       *string `json:"county"`
	City         *string `json:"city"`
	Ward         *string `json:"ward"`
	KyotoSt      *string `json:"kyoto_st"`
	OazaCho      *string `json:"oaza_cho"`
	Chome        *string `json:"chome"`
	Koaza        *string `json:"koaza"`
	MachiazaDist *string `json:"machiaza_dist"`
	BlkNum       *string `json:"blk_num"`
	RsdtNum      *string `json:"rsdt_num"`
	RsdtNum2     *string `json:"rsdt_num2"`
	PrcNum1      *string `json:"prc_num1"`
	PrcNum2      *string `json:"prc_num2"`
	PrcNum3      *string `json:"prc_num3"`
}

// mergePtr copies src to dst if dst is nil and src is not nil.
func mergePtr(dst, src **string) {
	if *dst == nil && *src != nil {
		*dst = *src
	}
}

// MergeFrom copies non-nil fields from src to dst where dst fields are nil.
func (dst *StructuredAddress) MergeFrom(src *StructuredAddress) {
	mergePtr(&dst.Pref, &src.Pref)
	mergePtr(&dst.County, &src.County)
	mergePtr(&dst.City, &src.City)
	mergePtr(&dst.Ward, &src.Ward)
	mergePtr(&dst.KyotoSt, &src.KyotoSt)
	mergePtr(&dst.OazaCho, &src.OazaCho)
	mergePtr(&dst.Chome, &src.Chome)
	mergePtr(&dst.Koaza, &src.Koaza)
	mergePtr(&dst.MachiazaDist, &src.MachiazaDist)
	mergePtr(&dst.BlkNum, &src.BlkNum)
	mergePtr(&dst.RsdtNum, &src.RsdtNum)
	mergePtr(&dst.RsdtNum2, &src.RsdtNum2)
	mergePtr(&dst.PrcNum1, &src.PrcNum1)
	mergePtr(&dst.PrcNum2, &src.PrcNum2)
	mergePtr(&dst.PrcNum3, &src.PrcNum3)
}

// FormatAddress constructs formatted address from StructuredAddress components including numbers.
// MachiazaDist is a disambiguator for same-named machiaza (e.g. kana reading), not part of
// the address notation, so it is intentionally excluded here.
func FormatAddress(sa *StructuredAddress) string {
	var sb strings.Builder
	sb.Grow(256)

	// Build base address parts
	writeStringPtr(&sb, sa.Pref)
	writeStringPtr(&sb, sa.County)
	writeStringPtr(&sb, sa.City)
	writeStringPtr(&sb, sa.Ward)
	writeStringPtr(&sb, sa.KyotoSt)
	writeStringPtr(&sb, sa.OazaCho)
	writeStringPtr(&sb, sa.Chome)
	writeStringPtr(&sb, sa.Koaza)

	// Residential addresses (BlkNum, RsdtNum, RsdtNum2)
	writeStringPtr(&sb, sa.BlkNum)
	if hasValue(sa.RsdtNum) {
		if hasValue(sa.BlkNum) {
			sb.WriteString("-")
		}
		sb.WriteString(*sa.RsdtNum)
	}
	writeWithPrefix(&sb, sa.RsdtNum2, "-")

	// Parcel addresses (PrcNum1, PrcNum2, PrcNum3)
	writeStringPtr(&sb, sa.PrcNum1)
	writeWithPrefix(&sb, sa.PrcNum2, "-")
	writeWithPrefix(&sb, sa.PrcNum3, "-")

	return sb.String()
}

func writeStringPtr(sb *strings.Builder, ptr *string) {
	if ptr != nil && *ptr != "" {
		sb.WriteString(*ptr)
	}
}

func writeWithPrefix(sb *strings.Builder, ptr *string, prefix string) {
	if ptr != nil && *ptr != "" {
		sb.WriteString(prefix)
		sb.WriteString(*ptr)
	}
}

func hasValue(ptr *string) bool {
	return ptr != nil && *ptr != ""
}

type ResultInfo struct {
	Count           int     `json:"count"`
	Limit           int     `json:"limit"`
	APIVersion      string  `json:"api_version"`
	DBVersion       string  `json:"db_version"`
	EnabledCategory string  `json:"enabled_category"`
	EnabledPref     string  `json:"enabled_pref"`
	DurationMs      float64 `json:"duration_ms,omitempty"` // Duration in milliseconds
}

// SetMeta fills the server/data metadata fields shared by all endpoints.
func (r *ResultInfo) SetMeta(apiVersion, dbVersion, enabledCategory, enabledPref string) {
	r.APIVersion = apiVersion
	r.DBVersion = dbVersion
	r.EnabledCategory = enabledCategory
	r.EnabledPref = enabledPref
}
