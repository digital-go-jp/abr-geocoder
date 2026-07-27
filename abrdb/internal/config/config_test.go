package config

import (
	"slices"
	"testing"

	"abrdb/internal/model"
)

func TestParsePref(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    []int
		wantErr bool
	}{
		{name: "single prefecture", input: "13", want: []int{13}},
		{name: "all prefectures", input: "all", want: model.AllPrefectureCodes()},
		{name: "multiple prefectures not allowed", input: "1,13,27", wantErr: true},
		{name: "invalid prefecture code", input: "48", wantErr: true},
		{name: "zero prefecture code", input: "0", wantErr: true},
		{name: "negative prefecture code", input: "-1", wantErr: true},
		{name: "empty input defaults to all", input: "", want: model.AllPrefectureCodes()},
		{name: "non-numeric input", input: "abc", wantErr: true},
		{name: "spaces are trimmed", input: " 13 ", want: []int{13}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParsePref(tt.input)
			if (err != nil) != tt.wantErr {
				t.Fatalf("ParsePref() error = %v, wantErr %v", err, tt.wantErr)
			}
			if !tt.wantErr && !slices.Equal(got, tt.want) {
				t.Fatalf("ParsePref() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestParseCategory(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    []model.FileCategory
		wantErr bool
	}{
		{name: "basic group", input: "basic", want: []model.FileCategory{model.CategoryPref, model.CategoryCity, model.CategoryTown}},
		{name: "rsdtdsp group", input: "rsdtdsp", want: []model.FileCategory{model.CategoryPref, model.CategoryCity, model.CategoryTown, model.CategoryRsdtdspBlk, model.CategoryRsdtdspRsdt}},
		{name: "parcel group", input: "parcel", want: []model.FileCategory{model.CategoryPref, model.CategoryCity, model.CategoryTown, model.CategoryParcel}},
		{name: "all category", input: "all", want: []model.FileCategory{model.CategoryPref, model.CategoryCity, model.CategoryTown, model.CategoryRsdtdspBlk, model.CategoryRsdtdspRsdt, model.CategoryParcel}},
		{name: "invalid group name", input: "address", wantErr: true},
		{name: "comma separated not allowed", input: "basic,parcel", wantErr: true},
		{name: "typo in group name", input: "basci", wantErr: true},
		{name: "invalid group", input: "invalid", wantErr: true},
		{name: "empty input", input: "", want: []model.FileCategory{}, wantErr: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseCategory(tt.input)
			if (err != nil) != tt.wantErr {
				t.Fatalf("ParseCategory() error = %v, wantErr %v", err, tt.wantErr)
			}
			if !tt.wantErr && !slices.Equal(got, tt.want) {
				t.Fatalf("ParseCategory() = %v, want %v", got, tt.want)
			}
		})
	}
}
