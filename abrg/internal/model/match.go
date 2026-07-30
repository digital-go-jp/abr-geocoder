package model

// MatchQuery represents the match request query
type MatchQuery struct {
	Address  string   `json:"address"`
	Category Category `json:"category"`
	// Pref restricts results to one prefecture code. "all" disables the
	// filter; an empty string is not equivalent and leaves prefecture
	// detection off in the matching engine.
	Pref  string `json:"pref"`
	Limit int    `json:"limit"`
}

// MatchedResult represents a matched address result
type MatchedResult struct {
	MatchedAddress string `json:"matched_address"`
	// UnmatchedAddress contains address parts that could not be matched.
	// Semantics:
	//   - nil: fully matched (no unmatched parts) → JSON: null
	//   - []string{"..."}: has unmatched parts → JSON: ["..."]
	// Producers must collapse empty slices to nil; clients never see [].
	UnmatchedAddress  []string          `json:"unmatched_address"`
	MatchLevel        MatchLevel        `json:"match_level"`
	Score             float64           `json:"score"`
	IDs               IDs               `json:"ids"`
	StructuredAddress StructuredAddress `json:"structured_address"`
	// Coordinates for geocoding (lon, lat) - internal use only, not exposed in normalize API response
	Coordinates []float64 `json:"-"`
	// Machiaza is set only for basic results, which are the ones the matcher
	// can run a second-stage search from.
	Machiaza MachiazaData `json:"-"`
}

// MatchResponse represents the match response
type MatchResponse struct {
	Type       string          `json:"type"`
	Query      MatchQuery      `json:"query"`
	ResultInfo ResultInfo      `json:"result_info"`
	Features   []MatchedResult `json:"features"`
}
