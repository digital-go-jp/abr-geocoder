package repository

import (
	"math"
	"testing"
)

func TestLatDegrees(t *testing.T) {
	const want = 0.0089932036
	if got := latDegrees(1000); math.Abs(got-want) > 1e-10 {
		t.Errorf("latDegrees(1000) = %.10f, want %.10f", got, want)
	}
}

func TestLonDegrees(t *testing.T) {
	tests := []struct {
		name string
		lat  float64
		want float64
	}{
		{name: "equator matches latitude span", lat: 0, want: 0.0089932036},
		{name: "latitude 35", lat: 35, want: 0.0109786745},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := lonDegrees(1000, tt.lat)
			if math.Abs(got-tt.want) > 1e-10 {
				t.Errorf("lonDegrees(1000, %v) = %.10f, want %.10f", tt.lat, got, tt.want)
			}
		})
	}
}

func TestLonDegreesIsCappedNearThePoles(t *testing.T) {
	for _, lat := range []float64{89.999, 90} {
		if got := lonDegrees(1000, lat); got != 180 {
			t.Errorf("lonDegrees(1000, %v) = %v, want 180", lat, got)
		}
	}
}
