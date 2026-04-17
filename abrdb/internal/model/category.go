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

// CategoryGroups defines predefined category groups
var CategoryGroups = map[string][]FileCategory{
	"basic":   {CategoryPref, CategoryCity, CategoryTown},
	"rsdtdsp": {CategoryPref, CategoryCity, CategoryTown, CategoryRsdtdspBlk, CategoryRsdtdspRsdt},
	"parcel":  {CategoryPref, CategoryCity, CategoryTown, CategoryParcel},
}

func CategoryGroup(groupName string) []FileCategory {
	return CategoryGroups[groupName]
}
