package command

import "testing"

func TestParseCoordinates(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantLon float64
		wantLat float64
		wantErr bool
	}{
		{
			name:    "valid tokyo",
			input:   "139.7369,35.6812",
			wantLon: 139.7369,
			wantLat: 35.6812,
			wantErr: false,
		},
		{
			name:    "with spaces",
			input:   " 139.7369 , 35.6812 ",
			wantLon: 139.7369,
			wantLat: 35.6812,
			wantErr: false,
		},
		{
			name:    "negative coordinates",
			input:   "-122.4194,37.7749",
			wantLon: -122.4194,
			wantLat: 37.7749,
			wantErr: false,
		},
		{
			name:    "empty string",
			input:   "",
			wantErr: true,
		},
		{
			name:    "no comma",
			input:   "139.7369 35.6812",
			wantErr: true,
		},
		{
			name:    "too many parts",
			input:   "139.7369,35.6812,100",
			wantErr: true,
		},
		{
			name:    "invalid longitude",
			input:   "abc,35.6812",
			wantErr: true,
		},
		{
			name:    "invalid latitude",
			input:   "139.7369,xyz",
			wantErr: true,
		},
		{
			name:    "longitude out of range",
			input:   "181,35",
			wantErr: true,
		},
		{
			name:    "latitude out of range",
			input:   "139,91",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			lon, lat, err := parseCoordinates(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("parseCoordinates(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
				return
			}
			if !tt.wantErr {
				if lon != tt.wantLon {
					t.Errorf("parseCoordinates(%q) lon = %v, want %v", tt.input, lon, tt.wantLon)
				}
				if lat != tt.wantLat {
					t.Errorf("parseCoordinates(%q) lat = %v, want %v", tt.input, lat, tt.wantLat)
				}
			}
		})
	}
}
