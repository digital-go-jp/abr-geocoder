package reverse

import (
	"testing"

	"abrg/internal/model"
)

// BenchmarkReverse benchmarks reverse geocoding operations
func BenchmarkReverse(b *testing.B) {
	geocoder, err := initTestReverseGeocoder()
	if err != nil {
		b.Skipf("Failed to create ReverseGeocoder: %v", err)
	}

	// Test coordinates (東京都千代田区紀尾井町付近)
	const (
		lon = 139.7369
		lat = 35.6812
	)

	cases := []struct {
		name     string
		category model.Category
		limit    int
	}{
		{"basic", model.CategoryBasic, 1},
		{"residential", model.CategoryResidential, 1},
		{"parcel", model.CategoryParcel, 1},
		{"all", model.CategoryAll, 1},
		{"all_limit5", model.CategoryAll, 5},
	}

	for _, tc := range cases {
		b.Run(tc.name, func(b *testing.B) {
			query := model.ReverseQuery{
				Lon:      lon,
				Lat:      lat,
				Category: tc.category,
				Pref:     model.All,
				Limit:    tc.limit,
			}
			b.ReportAllocs()
			for b.Loop() {
				_, _ = geocoder.Reverse(b.Context(), query)
			}
		})
	}
}

// BenchmarkReverseLocations benchmarks reverse geocoding at various locations
func BenchmarkReverseLocations(b *testing.B) {
	geocoder, err := initTestReverseGeocoder()
	if err != nil {
		b.Skipf("Failed to create ReverseGeocoder: %v", err)
	}

	locations := []struct {
		name string
		lon  float64
		lat  float64
	}{
		{"tokyo_chiyoda", 139.7369, 35.6812}, // 東京都千代田区
		{"osaka_umeda", 135.4959, 34.7024},   // 大阪市北区梅田
		{"sapporo", 141.3544, 43.0618},       // 札幌市中央区
		{"fukuoka", 130.4017, 33.5902},       // 福岡市博多区
		{"nagoya", 136.9066, 35.1815},        // 名古屋市中区
		{"rural_gunma", 139.0608, 36.3906},   // 群馬県前橋市（地方都市）
		{"rural_shimane", 133.0505, 35.4723}, // 島根県松江市（地方都市）
	}

	for _, loc := range locations {
		b.Run(loc.name, func(b *testing.B) {
			query := model.ReverseQuery{
				Lon:      loc.lon,
				Lat:      loc.lat,
				Category: model.CategoryAll,
				Pref:     model.All,
				Limit:    1,
			}
			b.ReportAllocs()
			for b.Loop() {
				_, _ = geocoder.Reverse(b.Context(), query)
			}
		})
	}
}
