package repository

import "abrg/internal/model"

// BasicSearchParams holds parameters for basic address search.
type BasicSearchParams struct {
	Address  string
	PrefCode string
	Limit    int
}

// BasicResult holds a row from cache_machiaza address search.
type BasicResult struct {
	NormalizedAddress string
	LgCode            string
	MachiazaID        string
	RsdtAddrFlg       *string
	Pref              string
	County            *string
	City              string
	Ward              *string
	KyotoSt           *string
	OazaCho           *string
	Chome             *string
	Koaza             *string
	MachiazaDist      *string
	HasChome          bool
	ParcelCount       int
	RsdtdspCount      int
	Lon               *float64
	Lat               *float64
}

// LevenshteinParams holds parameters for fuzzy Levenshtein search.
type LevenshteinParams struct {
	SearchAddr string   // Address to search for (used for editdist3 and location filter extraction)
	PrefCode   string   // Prefecture code filter
	LgCode     string   // Local government code filter
	MachiazaID string   // Machiaza ID filter (first 4 chars used for prefix match)
	LgCodes    []string // Candidate city codes, used as the filter when no single code is known
	Limit      int      // Desired result limit (internally multiplied for candidate pool)
}

// PrefixParams holds parameters for prefix-based address matching.
type PrefixParams struct {
	BaseAddr string // Base address to match as prefix
	PrefCode string // Prefecture code filter
	Limit    int    // Maximum number of results
}

// CitySearchParams holds parameters for city-level address search.
type CitySearchParams struct {
	CityAddr string // City-level address to match by normalized_address
	LgCode   string // If set, search by lg_code instead of normalized_address
	PrefCode string // Optional prefecture code filter for normalized_address search
}

// CityRecordParams holds parameters for city record lookup using starts_with.
type CityRecordParams struct {
	CityPart string // City part for starts_with matching
	PrefCode string // Optional prefecture code filter
}

// CityFuzzyParams holds parameters for fuzzy city record lookup.
type CityFuzzyParams struct {
	CityPart        string // City part to fuzzy-match
	PrefCode        string // Required prefecture code filter
	MaxEditDistance int    // Maximum edit distance for fuzzy matching
}

// CityResult holds a row from cache_city query.
type CityResult struct {
	LgCode string
	Pref   string
	County *string
	City   string
	Ward   *string
	Lon    *float64 // populated by FindCityByAddress only
	Lat    *float64 // populated by FindCityByAddress only
}

// PrefectureResult holds a row from cache_pref query.
type PrefectureResult struct {
	LgCode   string
	PrefName string
}

// ResidentialFilter specifies which fields to filter on for residential search.
type ResidentialFilter struct {
	BlkNum   string
	RsdtNum  string // optional
	RsdtNum2 string // optional
}

// ResidentialResult holds a row from cache_rsdtdsp search.
type ResidentialResult struct {
	LgCode     *string
	MachiazaID *string
	BlkID      *string
	RsdtID     *string
	Rsdt2ID    *string
	BlkNum     *string
	RsdtNum    *string
	RsdtNum2   *string
	Lon        *float64
	Lat        *float64
}

// ResidentialMatchLevel indicates how specifically a residential result matched.
type ResidentialMatchLevel int

const (
	MatchLevelBlk   ResidentialMatchLevel = 1
	MatchLevelRsdt  ResidentialMatchLevel = 2
	MatchLevelRsdt2 ResidentialMatchLevel = 3
)

// ResidentialBestResult holds the best-matching residential result with match level.
type ResidentialBestResult struct {
	ResidentialResult
	MatchLevel ResidentialMatchLevel
}

// ParcelFilter specifies which fields to filter on for parcel search.
type ParcelFilter struct {
	PrcNum1 string
	PrcNum2 string // optional, empty means NULL
	PrcNum3 string // optional, empty means NULL
}

// ParcelResult holds a row from cache_parcel search.
type ParcelResult struct {
	LgCode     *string
	MachiazaID *string
	PrcID      *string
	PrcNum1    *string
	PrcNum2    *string
	PrcNum3    *string
	Lon        *float64
	Lat        *float64
}

// SpatialParams holds parameters for spatial (reverse geocoding) queries.
type SpatialParams struct {
	Lon    float64
	Lat    float64
	Limit  int
	Pref   string // prefecture code filter, empty or "all" means no filter
	Radius float64
}

// ReverseBaseFields holds the common base address fields for reverse geocoding results.
type ReverseBaseFields struct {
	Pref         string
	County       *string
	City         string
	Ward         *string
	KyotoSt      *string
	OazaCho      *string
	Chome        *string
	Koaza        *string
	MachiazaDist *string
	RsdtAddrFlg  *string
	LgCode       string
	MachiazaID   string
	Lon          float64
	Lat          float64
	Distance     float64
}

// BaseSA builds a StructuredAddress from the common address fields.
func (b *ReverseBaseFields) BaseSA() model.StructuredAddress {
	return model.StructuredAddress{
		Pref: &b.Pref, County: b.County, City: &b.City, Ward: b.Ward,
		KyotoSt: b.KyotoSt, OazaCho: b.OazaCho, Chome: b.Chome,
		Koaza: b.Koaza, MachiazaDist: b.MachiazaDist,
	}
}

// ReverseResidentialResult holds a residential reverse geocoding result.
type ReverseResidentialResult struct {
	ReverseBaseFields
	BlkID    *string
	RsdtID   *string
	Rsdt2ID  *string
	BlkNum   *string
	RsdtNum  *string
	RsdtNum2 *string
}

// ReverseParcelResult holds a parcel reverse geocoding result.
type ReverseParcelResult struct {
	ReverseBaseFields
	PrcID   *string
	PrcNum1 *string
	PrcNum2 *string
	PrcNum3 *string
}
