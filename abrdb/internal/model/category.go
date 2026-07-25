package model

// FileCategory represents the category of address data
type FileCategory string

const (
	CategoryPref        FileCategory = "mt_pref"
	CategoryCity        FileCategory = "mt_city"
	CategoryTown        FileCategory = "mt_town"
	CategoryRsdtdspBlk  FileCategory = "mt_rsdtdsp_blk"
	CategoryRsdtdspRsdt FileCategory = "mt_rsdtdsp_rsdt"
	CategoryParcel      FileCategory = "mt_parcel"
)

// AllCategory defines all available file category values in order
var AllCategory = []FileCategory{
	CategoryPref,
	CategoryCity,
	CategoryTown,
	CategoryRsdtdspBlk,
	CategoryRsdtdspRsdt,
	CategoryParcel,
}

// categoryGroups defines predefined category groups
var categoryGroups = map[string][]FileCategory{
	"basic":   {CategoryPref, CategoryCity, CategoryTown},
	"rsdtdsp": {CategoryPref, CategoryCity, CategoryTown, CategoryRsdtdspBlk, CategoryRsdtdspRsdt},
	"parcel":  {CategoryPref, CategoryCity, CategoryTown, CategoryParcel},
}

func CategoryGroup(groupName string) []FileCategory {
	return categoryGroups[groupName]
}
