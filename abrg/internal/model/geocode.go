package model

type GeocodeProperties struct {
	MatchedAddress    string            `json:"matched_address"`
	UnmatchedAddress  []string          `json:"unmatched_address"`
	Score             float64           `json:"score"`
	MatchLevel        MatchLevel        `json:"match_level"`
	CoordinatesLevel  *MatchLevel       `json:"coordinates_level"`
	IDs               IDs               `json:"ids"`
	StructuredAddress StructuredAddress `json:"structured_address"`
}

type GeocodeFeature struct {
	Type       string            `json:"type"`
	Geometry   *Geometry         `json:"geometry"`
	Properties GeocodeProperties `json:"properties"`
}

type GeocodeResponse struct {
	Type       string           `json:"type"`
	Query      MatchQuery       `json:"query"`
	ResultInfo ResultInfo       `json:"result_info"`
	Features   []GeocodeFeature `json:"features"`
}

type Geometry struct {
	Type        string    `json:"type"`
	Coordinates []float64 `json:"coordinates"`
}
