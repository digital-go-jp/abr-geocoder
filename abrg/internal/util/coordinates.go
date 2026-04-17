package util

import (
	"fmt"
	"math"
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

// ValidateCoordinates validates that lon is in [-180, 180] and lat is in [-90, 90].
func ValidateCoordinates(lon, lat float64) error {
	if lon < -180 || lon > 180 {
		return fmt.Errorf("longitude out of range [-180, 180]: %f", lon)
	}
	if lat < -90 || lat > 90 {
		return fmt.Errorf("latitude out of range [-90, 90]: %f", lat)
	}
	return nil
}
