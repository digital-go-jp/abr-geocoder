package util

import (
	"fmt"
	"math"
)

// Latitude and longitude bounds for coordinate validation.
const (
	MinLat = -90.0
	MaxLat = 90.0
	MinLon = -180.0
	MaxLon = 180.0
)

// coordinatePrecision is the number of decimal places for coordinate rounding.
// 6 decimal places provides approximately 11cm precision, which matches
// the precision of the source data stored as float32 in PostgreSQL.
const coordinatePrecision = 6

// coordinateMultiplier is the multiplier for rounding coordinates to coordinatePrecision decimal places.
var coordinateMultiplier = math.Pow(10, coordinatePrecision)

// RoundCoordinates rounds coordinate values in place to coordinatePrecision decimal places.
// This prevents false precision from float32 to float64 conversion.
func RoundCoordinates(coords []float64) {
	for i := range coords {
		coords[i] = math.Round(coords[i]*coordinateMultiplier) / coordinateMultiplier
	}
}

// ValidateCoordinates validates that lon is in [MinLon, MaxLon] and lat is in [MinLat, MaxLat].
func ValidateCoordinates(lon, lat float64) error {
	if lon < MinLon || lon > MaxLon {
		return fmt.Errorf("longitude out of range [%g, %g]: %f", MinLon, MaxLon, lon)
	}
	if lat < MinLat || lat > MaxLat {
		return fmt.Errorf("latitude out of range [%g, %g]: %f", MinLat, MaxLat, lat)
	}
	return nil
}
