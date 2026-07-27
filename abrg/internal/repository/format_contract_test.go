package repository

import (
	"testing"

	"abrg/internal/model"
)

// TestFormatAddress_CityRowsMatchPlainConcat pins the data premise behind
// matching.buildCityResult: model.FormatAddress inserts a hyphen
// between adjacent ASCII digits across parts, so replacing the former plain
// concatenation of pref+county+city+ward is only equivalent while no
// administrative name in cache_city ends or starts with an ASCII digit.
// This verifies the premise against every cache_city row of the quickstart
// cache instead of assuming it.
func TestFormatAddress_CityRowsMatchPlainConcat(t *testing.T) {
	repo := setupRepo(t)

	rows, err := repo.db.QueryContext(t.Context(), `SELECT pref, COALESCE(county, ''), city, COALESCE(ward, '') FROM cache_city`)
	if err != nil {
		t.Fatalf("query cache_city: %v", err)
	}
	defer func() { _ = rows.Close() }()

	checked := 0
	for rows.Next() {
		var pref, county, city, ward string
		if err := rows.Scan(&pref, &county, &city, &ward); err != nil {
			t.Fatalf("scan cache_city row: %v", err)
		}

		sa := model.StructuredAddress{Pref: &pref, City: &city}
		if county != "" {
			sa.County = &county
		}
		if ward != "" {
			sa.Ward = &ward
		}

		plain := pref + county + city + ward
		if got := model.FormatAddress(&sa); got != plain {
			t.Errorf("FormatAddress = %q, want plain concatenation %q (digit-boundary hyphen premise violated)", got, plain)
		}
		checked++
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate cache_city rows: %v", err)
	}
	if checked == 0 {
		t.Fatal("cache_city returned no rows; contract not exercised")
	}
}
