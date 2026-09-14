package repository

import (
	"fmt"
	"math"
)

// earthRadiusMeters is the IUGG arithmetic mean radius of the WGS84 ellipsoid.
const earthRadiusMeters = 6371008.8

const metersPerLatDegree = earthRadiusMeters * math.Pi / 180

// latDegrees returns the latitude span covering meters.
func latDegrees(meters float64) float64 {
	return meters / metersPerLatDegree
}

// lonDegrees returns the longitude span covering meters at lat, at most 180.
func lonDegrees(meters, lat float64) float64 {
	return min(latDegrees(meters)/cosLat(lat), 180)
}

func cosLat(lat float64) float64 {
	return math.Cos(lat * math.Pi / 180)
}

// distanceExpr is a SQL expression for the distance in metres from alias to
// (lon, lat). It is a planar approximation, within 0.9 m of the great-circle
// distance anywhere in Japan.
func distanceExpr(alias string, lon, lat float64) string {
	return fmt.Sprintf(
		"sqrt(pow((%[1]s.lon - %[2]f) * %[4]f * %[5]f, 2) + pow((%[1]s.lat - %[3]f) * %[4]f, 2))",
		alias, lon, lat, metersPerLatDegree, cosLat(lat),
	)
}

// withinRadiusExpr is a SQL predicate matching rows of alias within meters of
// (lon, lat). The bounding box lets DuckDB skip row groups by their lon and lat
// ranges.
func withinRadiusExpr(alias string, lon, lat, meters float64) string {
	dLon := lonDegrees(meters, lat)
	dLat := latDegrees(meters)
	return fmt.Sprintf(
		"%[1]s.lon BETWEEN %[2]f AND %[3]f AND %[1]s.lat BETWEEN %[4]f AND %[5]f AND %[6]s <= %[7]f",
		alias, lon-dLon, lon+dLon, lat-dLat, lat+dLat, distanceExpr(alias, lon, lat), meters,
	)
}
