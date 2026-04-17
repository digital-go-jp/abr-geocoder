package util

import (
	"slices"
	"testing"
)

func TestRoundCoordinates(t *testing.T) {
	tests := []struct {
		name  string
		input []float64
		want  []float64
	}{
		{
			name:  "lon lat pair",
			input: []float64{135.5193634033203, 34.657867431640625},
			want:  []float64{135.519363, 34.657867},
		},
		{
			name:  "negative longitude",
			input: []float64{-122.4194155, 37.7749295},
			want:  []float64{-122.419416, 37.77493},
		},
		{
			name:  "already rounded",
			input: []float64{135.519363, 34.657867},
			want:  []float64{135.519363, 34.657867},
		},
		{
			name:  "nil slice",
			input: nil,
			want:  nil,
		},
		{
			name:  "empty slice",
			input: []float64{},
			want:  []float64{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			RoundCoordinates(tt.input)
			if !slices.Equal(tt.input, tt.want) {
				t.Errorf("RoundCoordinates() = %v, want %v", tt.input, tt.want)
			}
		})
	}
}

func TestValidateCoordinates(t *testing.T) {
	tests := []struct {
		name    string
		lon     float64
		lat     float64
		wantErr bool
	}{
		{name: "valid tokyo", lon: 139.7369, lat: 35.6812, wantErr: false},
		{name: "valid boundary", lon: 180, lat: 90, wantErr: false},
		{name: "valid negative boundary", lon: -180, lat: -90, wantErr: false},
		{name: "longitude too high", lon: 181, lat: 35, wantErr: true},
		{name: "longitude too low", lon: -181, lat: 35, wantErr: true},
		{name: "latitude too high", lon: 139, lat: 91, wantErr: true},
		{name: "latitude too low", lon: 139, lat: -91, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateCoordinates(tt.lon, tt.lat)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateCoordinates(%v, %v) error = %v, wantErr %v", tt.lon, tt.lat, err, tt.wantErr)
			}
		})
	}
}
