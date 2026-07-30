// Package levenshtein provides fuzzy address matching using Levenshtein distance.
package levenshtein

import (
	"time"

	"abrg/internal/model"
	"abrg/internal/util"
)

// Levenshtein search configuration constants.
const (
	// queryTimeout is the maximum time allowed for a single database query.
	queryTimeout = 5 * time.Second

	// minPrefixMatchLength is the minimum length of base address required for prefix matching.
	// Addresses shorter than this (e.g., less than city + some characters) are skipped.
	minPrefixMatchLength = 5
)

// SearchParams holds parameters for Levenshtein search.
type SearchParams struct {
	Category       model.Category // Search category (basic, residential, parcel)
	SearchAddr     string         // Address to search for in DB
	Pref           string         // Prefecture code to filter by
	LgCode         string         // Local government code
	MachiazaID     string         // Machiaza ID for filtering
	NormalizedAddr string         // Basic-normalized address, used for computing unmatched parts
	Limit          int            // Maximum number of results

	CityBoundary *util.CityBoundary // City-boundary matcher for longest-prefix city resolution
}

// hasRegionAnchor reports whether the params carry a code that scopes the
// machiaza search. It mirrors the filters FindBasicByLevenshtein applies: a
// machiaza ID alone is not one, since it only narrows within an lg_code.
func (p SearchParams) hasRegionAnchor() bool {
	return p.LgCode != "" || (p.Pref != "" && p.Pref != model.All)
}

// cityPart returns the leading city name of the search address, or "" when the
// address names no city. A misspelled city name still yields one, which is what
// the search scopes on when no code was detected.
func (p SearchParams) cityPart() string {
	end := p.CityBoundary.Find(p.SearchAddr)
	if end <= 0 {
		return ""
	}
	return p.SearchAddr[:end]
}
