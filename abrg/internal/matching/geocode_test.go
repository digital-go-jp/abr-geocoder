package matching_test

import (
	"context"
	"testing"

	"abrg/internal/matching"
	"abrg/internal/model"
	"abrg/internal/repository"
)

type geocodeTestDeps struct {
	normalizer matching.Matcher
	repo       *repository.DB
}

func setupGeocodeTest(t *testing.T) *geocodeTestDeps {
	t.Helper()
	c := matching.SetupTestCache(t)
	repo := repository.NewRepository(c.DB())
	normalizer := matching.NewMatcher(repo, c.Lookups())
	return &geocodeTestDeps{normalizer: normalizer, repo: repo}
}

type geocodeTestCase struct {
	name string
	// Input
	address  string
	category model.Category
	pref     string
	limit    int
	// Expected output
	wantMatchLevel       model.MatchLevel
	wantCoordinatesLevel model.MatchLevel
	wantMatchedAddress   string
	wantHasCoordinates   bool
}

func runGeocodeTests(t *testing.T, tests []geocodeTestCase) {
	deps := setupGeocodeTest(t)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			query := model.MatchQuery{
				Address:  tt.address,
				Category: tt.category,
				Pref:     tt.pref,
				Limit:    tt.limit,
			}
			if query.Category == "" {
				query.Category = model.CategoryAll
			}
			if query.Pref == "" {
				query.Pref = "all"
			}
			if query.Limit == 0 {
				query.Limit = 1
			}

			response, err := matching.Geocode(context.Background(), deps.normalizer, deps.repo, query)
			if err != nil {
				t.Fatalf("Geocode(%q) unexpected error: %v", tt.address, err)
			}

			if response == nil {
				t.Fatal("Geocode() returned nil response")
			}

			if len(response.Features) == 0 {
				if tt.wantHasCoordinates {
					t.Fatal("Geocode() returned no features, expected coordinates")
				}
				return
			}

			feature := response.Features[0]

			if tt.wantHasCoordinates {
				if feature.Geometry == nil || len(feature.Geometry.Coordinates) != 2 {
					t.Errorf("Geocode() expected 2 coordinates, got geometry=%v", feature.Geometry)
				}
			}

			if tt.wantMatchLevel != "" {
				if feature.Properties.MatchLevel != tt.wantMatchLevel {
					t.Errorf("match_level = %v, want %v", feature.Properties.MatchLevel, tt.wantMatchLevel)
				}
			}

			if tt.wantCoordinatesLevel != "" {
				if feature.Properties.CoordinatesLevel == nil || *feature.Properties.CoordinatesLevel != tt.wantCoordinatesLevel {
					t.Errorf("coordinates_level = %v, want %v", feature.Properties.CoordinatesLevel, tt.wantCoordinatesLevel)
				}
			}

			if tt.wantMatchedAddress != "" {
				if feature.Properties.MatchedAddress != tt.wantMatchedAddress {
					t.Errorf("matched_address = %v, want %v", feature.Properties.MatchedAddress, tt.wantMatchedAddress)
				}
			}
		})
	}
}

func TestGeocodeBasic(t *testing.T) {
	runGeocodeTests(t, []geocodeTestCase{
		{
			name:                 "都道府県レベル",
			address:              "群馬県",
			category:             model.CategoryBasic,
			wantMatchLevel:       model.MatchLevelPrefecture,
			wantCoordinatesLevel: model.MatchLevelPrefecture,
			wantMatchedAddress:   "群馬県",
			wantHasCoordinates:   true,
		},
		{
			name:                 "市区町村レベル",
			address:              "群馬県前橋市",
			category:             model.CategoryBasic,
			wantMatchLevel:       model.MatchLevelCity,
			wantCoordinatesLevel: model.MatchLevelCity,
			wantMatchedAddress:   "群馬県前橋市",
			wantHasCoordinates:   true,
		},
		{
			name:                 "町字レベル",
			address:              "群馬県前橋市小屋原町",
			category:             model.CategoryBasic,
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantCoordinatesLevel: model.MatchLevelMachiaza,
			wantMatchedAddress:   "群馬県前橋市小屋原町",
			wantHasCoordinates:   true,
		},
		{
			name:                 "丁目詳細レベル",
			address:              "東京都千代田区永田町一丁目",
			category:             model.CategoryBasic,
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantCoordinatesLevel: model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "東京都千代田区永田町一丁目",
			wantHasCoordinates:   true,
		},
	})
}

func TestGeocodeResidential(t *testing.T) {
	runGeocodeTests(t, []geocodeTestCase{
		{
			name:               "住居表示 - 街区レベル",
			address:            "東京都千代田区永田町一丁目3",
			category:           model.CategoryResidential,
			wantMatchLevel:     model.MatchLevelResidentialBlock,
			wantMatchedAddress: "東京都千代田区永田町一丁目3",
			wantHasCoordinates: true,
		},
		{
			name:               "住居表示 - 住居番号レベル",
			address:            "東京都千代田区紀尾井町1-3",
			category:           model.CategoryResidential,
			wantMatchLevel:     model.MatchLevelResidentialDetail,
			wantMatchedAddress: "東京都千代田区紀尾井町1-3",
			wantHasCoordinates: true,
		},
	})
}

func TestGeocodeParcel(t *testing.T) {
	runGeocodeTests(t, []geocodeTestCase{
		{
			name:               "地番 - 丁目あり",
			address:            "東京都千代田区神田鍛冶町三丁目3-1",
			category:           model.CategoryParcel,
			wantMatchLevel:     model.MatchLevelParcel,
			wantMatchedAddress: "東京都千代田区神田鍛冶町三丁目3-1",
			wantHasCoordinates: true,
		},
		{
			name:               "地番 - 丁目なし",
			address:            "群馬県前橋市小屋原町1154-4",
			category:           model.CategoryParcel,
			wantMatchLevel:     model.MatchLevelParcel,
			wantMatchedAddress: "群馬県前橋市小屋原町1154-4",
			wantHasCoordinates: true,
		},
	})
}

func TestGeocodeAll(t *testing.T) {
	runGeocodeTests(t, []geocodeTestCase{
		{
			name:                 "category=all - 地番",
			address:              "群馬県前橋市小屋原町1154-4",
			category:             model.CategoryAll,
			wantMatchLevel:       model.MatchLevelParcel,
			wantCoordinatesLevel: model.MatchLevelMachiaza,
			wantMatchedAddress:   "群馬県前橋市小屋原町1154-4",
			wantHasCoordinates:   true,
		},
		{
			name:               "京都府の住所（通り名）",
			address:            "京都府京都市中京区寺町通御池上る上本能寺前町488",
			category:           model.CategoryAll,
			wantMatchLevel:     model.MatchLevelParcel,
			wantHasCoordinates: true,
		},
	})
}

func TestGeocodeCoordinatesFallback(t *testing.T) {
	runGeocodeTests(t, []geocodeTestCase{
		{
			name:                 "座標フォールバック - 丁目レベル",
			address:              "東京都千代田区紀尾井町1-3",
			category:             model.CategoryResidential,
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantCoordinatesLevel: model.MatchLevelResidentialDetail,
			wantHasCoordinates:   true,
		},
		{
			name:                 "座標フォールバック - 町字レベル",
			address:              "群馬県前橋市小屋原町9999",
			category:             model.CategoryParcel,
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantCoordinatesLevel: model.MatchLevelMachiaza,
			wantMatchedAddress:   "群馬県前橋市小屋原町",
			wantHasCoordinates:   true,
		},
		{
			name:                 "座標フォールバック - 市区町村レベル",
			address:              "東京都千代田区",
			category:             model.CategoryBasic,
			wantMatchLevel:       model.MatchLevelCity,
			wantCoordinatesLevel: model.MatchLevelCity,
			wantHasCoordinates:   true,
		},
	})
}

func TestGeocodeNoCoordinates(t *testing.T) {
	deps := setupGeocodeTest(t)

	query := model.MatchQuery{
		Address:  "東京都千代田区紀尾井町1-3",
		Category: model.CategoryResidential,
		Pref:     "all",
		Limit:    1,
	}

	response, err := matching.Geocode(context.Background(), deps.normalizer, deps.repo, query)
	if err != nil {
		t.Fatalf("Geocode(%q) unexpected error: %v", query.Address, err)
	}

	if len(response.Features) == 0 {
		t.Skip("No features returned")
	}

	feature := response.Features[0]

	if feature.Geometry == nil || len(feature.Geometry.Coordinates) != 2 {
		t.Fatalf("Expected 2 coordinates, got geometry=%v", feature.Geometry)
	}

	lon := feature.Geometry.Coordinates[0]
	lat := feature.Geometry.Coordinates[1]

	if lon < 122.0 || lon > 154.0 {
		t.Errorf("Longitude %f is outside Japan's bounds", lon)
	}
	if lat < 20.0 || lat > 46.0 {
		t.Errorf("Latitude %f is outside Japan's bounds", lat)
	}
}

func TestGeocodeCoordinatesLevel(t *testing.T) {
	deps := setupGeocodeTest(t)

	testCases := []struct {
		name                 string
		address              string
		category             model.Category
		wantCoordinatesLevel model.MatchLevel
	}{
		{
			name:                 "都道府県座標レベル",
			address:              "群馬県",
			category:             model.CategoryBasic,
			wantCoordinatesLevel: model.MatchLevelPrefecture,
		},
		{
			name:                 "市区町村座標レベル",
			address:              "群馬県前橋市",
			category:             model.CategoryBasic,
			wantCoordinatesLevel: model.MatchLevelCity,
		},
		{
			name:                 "町字座標レベル",
			address:              "群馬県前橋市小屋原町",
			category:             model.CategoryBasic,
			wantCoordinatesLevel: model.MatchLevelMachiaza,
		},
		{
			name:                 "丁目座標レベル",
			address:              "東京都千代田区永田町一丁目",
			category:             model.CategoryBasic,
			wantCoordinatesLevel: model.MatchLevelMachiazaDetail,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			query := model.MatchQuery{
				Address:  tc.address,
				Category: tc.category,
				Pref:     "all",
				Limit:    1,
			}

			response, err := matching.Geocode(context.Background(), deps.normalizer, deps.repo, query)
			if err != nil {
				t.Fatalf("Geocode(%q) unexpected error: %v", tc.address, err)
			}

			if len(response.Features) == 0 {
				t.Skip("No features returned")
			}

			feature := response.Features[0]
			if feature.Properties.CoordinatesLevel == nil || *feature.Properties.CoordinatesLevel != tc.wantCoordinatesLevel {
				t.Errorf("coordinates_level = %v, want %v", feature.Properties.CoordinatesLevel, tc.wantCoordinatesLevel)
			}
		})
	}
}

func TestGeocodeUnmatchedAddress(t *testing.T) {
	deps := setupGeocodeTest(t)

	tests := []struct {
		name    string
		address string
	}{
		{
			name:    "ビル名のみ",
			address: "虎ノ門ヒルズ森タワー",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			query := model.MatchQuery{
				Address:  tt.address,
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			}

			response, err := matching.Geocode(context.Background(), deps.normalizer, deps.repo, query)
			if err != nil {
				t.Fatalf("Geocode(%q) unexpected error: %v", tt.address, err)
			}

			if len(response.Features) == 0 {
				t.Fatal("Geocode() returned no features, want at least 1 unmatched feature")
			}

			feature := response.Features[0]

			if feature.Geometry != nil {
				t.Errorf("geometry = %v, want nil for unmatched address", feature.Geometry)
			}

			if feature.Properties.CoordinatesLevel != nil {
				t.Errorf("coordinates_level = %v, want nil for unmatched address", feature.Properties.CoordinatesLevel)
			}

			if feature.Properties.MatchLevel != model.MatchLevelUnknown {
				t.Errorf("match_level = %v, want %v", feature.Properties.MatchLevel, model.MatchLevelUnknown)
			}

			if feature.Properties.MatchedAddress != "" {
				t.Errorf("matched_address = %q, want empty", feature.Properties.MatchedAddress)
			}

			if len(feature.Properties.UnmatchedAddress) == 0 {
				t.Error("unmatched_address is empty, want non-empty")
			}
		})
	}
}
