package model

// ReverseQuery represents the reverse geocoding request query
type ReverseQuery struct {
	Lon      float64  `json:"lon"`
	Lat      float64  `json:"lat"`
	Category Category `json:"category"`
	Pref     string   `json:"pref"`
	Limit    int      `json:"limit"`
}

// ReverseProperties represents the properties of a reverse geocoded feature
type ReverseProperties struct {
	Address           string            `json:"address"`
	MatchLevel        MatchLevel        `json:"match_level"`
	Distance          float64           `json:"distance"`
	IDs               IDs               `json:"ids"`
	StructuredAddress StructuredAddress `json:"structured_address"`
}

// ReverseFeature represents a GeoJSON feature for reverse geocoding
type ReverseFeature struct {
	Type       string            `json:"type"`
	Geometry   Geometry          `json:"geometry"`
	Properties ReverseProperties `json:"properties"`
}

// ReverseResponse represents the reverse geocoding response
type ReverseResponse struct {
	Type       string           `json:"type"`
	Query      ReverseQuery     `json:"query"`
	ResultInfo ResultInfo       `json:"result_info"`
	Features   []ReverseFeature `json:"features"`
}
