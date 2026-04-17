package validate

import (
	"testing"
)

func TestIsValidPrefectureCode(t *testing.T) {
	tests := []struct {
		code int
		want bool
	}{
		{0, false},
		{1, true},
		{13, true},
		{47, true},
		{48, false},
		{-1, false},
	}

	for _, tt := range tests {
		got := isValidPrefectureCode(tt.code)
		if got != tt.want {
			t.Errorf("isValidPrefectureCode(%d) = %v, want %v", tt.code, got, tt.want)
		}
	}
}

func TestParsePrefectureCode(t *testing.T) {
	tests := []struct {
		input   string
		want    int
		wantErr bool
	}{
		// Valid codes
		{"1", 1, false},
		{" 13 ", 13, false},
		{"13", 13, false},
		{"47", 47, false},
		// Invalid codes
		{"", 0, true},    // empty string
		{"all", 0, true}, // "all" is not a numeric code
		{"ALL", 0, true},
		{" all ", 0, true},
		{"0", 0, true},  // out of range
		{"48", 0, true}, // out of range
		{"abc", 0, true},
	}

	for _, tt := range tests {
		got, err := ParsePrefectureCode(tt.input)
		if (err != nil) != tt.wantErr {
			t.Errorf("ParsePrefectureCode(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			continue
		}
		if got != tt.want {
			t.Errorf("ParsePrefectureCode(%q) = %v, want %v", tt.input, got, tt.want)
		}
	}
}
