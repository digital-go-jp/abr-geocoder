package repository

import (
	"context"
	"database/sql"
	"fmt"
	"math"
	"testing"

	"abr.local/common/duck"
)

// greatCircleMeters is the haversine distance on a sphere of earthRadiusMeters.
func greatCircleMeters(lon1, lat1, lon2, lat2 float64) float64 {
	rad := math.Pi / 180
	dLat := (lat2 - lat1) * rad
	dLon := (lon2 - lon1) * rad
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*rad)*math.Cos(lat2*rad)*math.Sin(dLon/2)*math.Sin(dLon/2)
	return 2 * earthRadiusMeters * math.Asin(math.Sqrt(a))
}

// newPointsDB opens an in-memory DuckDB holding a table of coordinates.
func newPointsDB(t *testing.T, points [][2]float64) *sql.DB {
	t.Helper()
	db, err := duck.Open("")
	if err != nil {
		t.Fatalf("open duckdb: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	ctx := context.Background()
	if _, err := db.ExecContext(ctx, "CREATE TABLE p (lon FLOAT, lat FLOAT)"); err != nil {
		t.Fatalf("create table: %v", err)
	}
	for _, pt := range points {
		if _, err := db.ExecContext(ctx, "INSERT INTO p VALUES (?, ?)", pt[0], pt[1]); err != nil {
			t.Fatalf("insert %v: %v", pt, err)
		}
	}
	return db
}

func TestDistanceExprMatchesGreatCircle(t *testing.T) {
	const radius = 1000.0
	const tolerance = 0.9 // the accuracy distanceExpr documents

	queries := []struct {
		name string
		lon  float64
		lat  float64
	}{
		{name: "Tokyo", lon: kioichoLon, lat: kioichoLat},
		{name: "large rounding error", lon: 139.755684, lat: 20.213153},
	}

	for _, q := range queries {
		t.Run(q.name, func(t *testing.T) {
			dLon, dLat := lonDegrees(radius, q.lat), latDegrees(radius)

			var points [][2]float64
			for _, sx := range []float64{-1, 0, 1} {
				for _, sy := range []float64{-1, 0, 1} {
					points = append(points, [2]float64{q.lon + sx*dLon, q.lat + sy*dLat})
				}
			}
			db := newPointsDB(t, points)

			query := fmt.Sprintf("SELECT p.lon, p.lat, %s FROM p", distanceExpr("p", q.lon, q.lat))
			rows, err := db.QueryContext(context.Background(), query)
			if err != nil {
				t.Fatalf("query %s: %v", query, err)
			}
			defer func() { _ = rows.Close() }()

			seen := 0
			for rows.Next() {
				// float32 keeps the stored value exact.
				var lon, lat float32
				var got float64
				if err := rows.Scan(&lon, &lat, &got); err != nil {
					t.Fatalf("scan: %v", err)
				}
				want := greatCircleMeters(q.lon, q.lat, float64(lon), float64(lat))
				if diff := math.Abs(got - want); diff > tolerance {
					t.Errorf("distance to (%v, %v) = %.6f m, great circle %.6f m, off by %.6f m",
						lon, lat, got, want, diff)
				}
				seen++
			}
			if err := rows.Err(); err != nil {
				t.Fatalf("rows: %v", err)
			}
			if seen != len(points) {
				t.Errorf("got %d rows, want %d", seen, len(points))
			}
		})
	}
}

func TestWithinRadiusExprSelectsTheRadiusInEveryDirection(t *testing.T) {
	const qLon, qLat = kioichoLon, kioichoLat
	const radius = 1000.0

	inLat, inLon := latDegrees(radius)*0.99, lonDegrees(radius, qLat)*0.99
	outLat, outLon := latDegrees(radius)*1.01, lonDegrees(radius, qLat)*1.01

	tests := []struct {
		name string
		dLon float64
		dLat float64
		want bool
	}{
		{name: "inside to the north", dLat: inLat, want: true},
		{name: "inside to the south", dLat: -inLat, want: true},
		{name: "inside to the east", dLon: inLon, want: true},
		{name: "inside to the west", dLon: -inLon, want: true},
		{name: "inside to the northeast", dLon: inLon / math.Sqrt2, dLat: inLat / math.Sqrt2, want: true},
		{name: "inside to the southwest", dLon: -inLon / math.Sqrt2, dLat: -inLat / math.Sqrt2, want: true},
		{name: "outside to the north", dLat: outLat},
		{name: "outside to the south", dLat: -outLat},
		{name: "outside to the east", dLon: outLon},
		{name: "outside to the west", dLon: -outLon},
		{name: "outside to the northeast", dLon: outLon / math.Sqrt2, dLat: outLat / math.Sqrt2},
		{name: "outside to the southwest", dLon: -outLon / math.Sqrt2, dLat: -outLat / math.Sqrt2},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := newPointsDB(t, [][2]float64{{qLon + tt.dLon, qLat + tt.dLat}})
			query := fmt.Sprintf("SELECT count(*) FROM p WHERE %s",
				withinRadiusExpr("p", qLon, qLat, radius))
			var n int
			if err := db.QueryRowContext(context.Background(), query).Scan(&n); err != nil {
				t.Fatalf("query %s: %v", query, err)
			}
			if got := n == 1; got != tt.want {
				t.Errorf("selected = %v, want %v", got, tt.want)
			}
		})
	}
}
