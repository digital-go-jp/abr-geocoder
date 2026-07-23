package reverse

import (
	"context"
	"strings"
	"testing"

	"abrg/internal/cache"
	"abrg/internal/model"
	"abrg/internal/repository"
	"abrg/internal/testutil"
)

var initTestReverseGeocoder = testutil.NewCacheOnce(func(c *cache.DuckDBCache) (*ReverseGeocoder, error) {
	db := c.DB()
	return NewReverseGeocoder(
		repository.NewRepository(db),
		TableExists(context.Background(), db, "cache_rsdtdsp"),
		TableExists(context.Background(), db, "cache_parcel"),
	), nil
})

func setupTestReverseGeocoder(t *testing.T) *ReverseGeocoder {
	t.Helper()
	return testutil.Setup(t, initTestReverseGeocoder)
}

type reverseTestCase struct {
	name               string
	lon                float64
	lat                float64
	category           model.Category
	limit              int
	wantMinResults     int
	wantMatchLevel     model.MatchLevel
	wantAddressContain string
}

func runReverseTests(t *testing.T, tests []reverseTestCase) {
	geocoder := setupTestReverseGeocoder(t)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			query := model.ReverseQuery{
				Lon:      tt.lon,
				Lat:      tt.lat,
				Category: tt.category,
				Pref:     "all",
				Limit:    tt.limit,
			}

			response, err := geocoder.Reverse(t.Context(), query)
			if err != nil {
				t.Fatalf("Reverse(lat=%v, lon=%v) unexpected error: %v", tt.lat, tt.lon, err)
			}

			if response == nil {
				t.Fatal("Reverse() returned nil response")
			}

			if len(response.Features) < tt.wantMinResults {
				t.Errorf("Reverse() returned %d features, want at least %d", len(response.Features), tt.wantMinResults)
				return
			}

			if tt.wantMinResults > 0 && len(response.Features) > 0 {
				feature := response.Features[0]

				// Check match level
				if tt.wantMatchLevel != "" && feature.Properties.MatchLevel != tt.wantMatchLevel {
					t.Errorf("match_level = %v, want %v", feature.Properties.MatchLevel, tt.wantMatchLevel)
				}

				// Check address contains expected string
				if tt.wantAddressContain != "" {
					if !strings.Contains(feature.Properties.Address, tt.wantAddressContain) {
						t.Errorf("address = %v, want to contain %v", feature.Properties.Address, tt.wantAddressContain)
					}
				}

				// Check coordinates are returned
				if len(feature.Geometry.Coordinates) != 2 {
					t.Error("Reverse() returned feature without coordinates")
				}

				// Check distance is set
				if feature.Properties.Distance <= 0 {
					t.Error("Reverse() returned feature without distance")
				}
			}
		})
	}
}

// TestReverseResidential tests reverse geocoding for residential addresses
func TestReverseResidential(t *testing.T) {
	runReverseTests(t, []reverseTestCase{
		{
			// 東京都千代田区紀尾井町付近（住居表示エリア）
			// 最寄りのデータが街区レベルの場合もある
			name:               "住居表示エリア - 紀尾井町",
			lon:                139.7369,
			lat:                35.6812,
			category:           model.CategoryResidential,
			limit:              1,
			wantMinResults:     1,
			wantMatchLevel:     "", // 街区または住居番号レベル
			wantAddressContain: "千代田区",
		},
	})
}

// TestReverseParcel tests reverse geocoding for parcel addresses
func TestReverseParcel(t *testing.T) {
	runReverseTests(t, []reverseTestCase{
		{
			// 東京都千代田区付近（地番エリア）
			name:               "地番エリア",
			lon:                139.7530,
			lat:                35.6940,
			category:           model.CategoryParcel,
			limit:              1,
			wantMinResults:     0, // 地番データがない場合もあるので0
			wantAddressContain: "",
		},
	})
}

// TestReverseAll tests reverse geocoding for all address types
func TestReverseAll(t *testing.T) {
	runReverseTests(t, []reverseTestCase{
		{
			// 東京都千代田区永田町付近
			name:               "全データ検索",
			lon:                139.7460,
			lat:                35.6760,
			category:           model.CategoryAll,
			limit:              3,
			wantMinResults:     1,
			wantAddressContain: "",
		},
	})
}

// TestReverseNoResults tests reverse geocoding with coordinates outside data area
func TestReverseNoResults(t *testing.T) {
	runReverseTests(t, []reverseTestCase{
		{
			// 太平洋上（データなし）
			name:           "データ範囲外",
			lon:            145.0,
			lat:            35.0,
			category:       model.CategoryResidential,
			limit:          1,
			wantMinResults: 0,
		},
	})
}

// TestReverseBasic tests reverse geocoding for basic (town-level) addresses
func TestReverseBasic(t *testing.T) {
	runReverseTests(t, []reverseTestCase{
		{
			// 東京都千代田区永田町付近（丁目データあり）
			name:               "町字レベル検索",
			lon:                139.7460,
			lat:                35.6760,
			category:           model.CategoryBasic,
			limit:              1,
			wantMinResults:     1,
			wantMatchLevel:     model.MatchLevelMachiazaDetail,
			wantAddressContain: "",
		},
	})
}

// TestReverseMultipleResults tests reverse geocoding with limit > 1
func TestReverseMultipleResults(t *testing.T) {
	runReverseTests(t, []reverseTestCase{
		{
			name:           "複数結果取得",
			lon:            139.7460,
			lat:            35.6760,
			category:       model.CategoryBasic,
			limit:          5,
			wantMinResults: 1,
		},
	})
}

// Unit tests for helper functions

// TestBuildBaseAddress tests the model.StructuredAddress and model.FormatAddress functions
func TestBuildBaseAddress(t *testing.T) {
	tests := []struct {
		name           string
		sa             model.StructuredAddress
		wantAddress    string
		wantHasPref    bool
		wantHasCity    bool
		wantHasOazaCho bool
	}{
		{
			name: "all fields populated",
			sa: model.StructuredAddress{
				Pref:    new("東京都"),
				County:  new(""),
				City:    new("千代田区"),
				Ward:    new(""),
				OazaCho: new("永田町"),
				Chome:   new("一丁目"),
				Koaza:   new(""),
			},
			wantAddress:    "東京都千代田区永田町一丁目",
			wantHasPref:    true,
			wantHasCity:    true,
			wantHasOazaCho: true,
		},
		{
			name: "minimal fields",
			sa: model.StructuredAddress{
				Pref:    new("群馬県"),
				County:  new(""),
				City:    new("前橋市"),
				Ward:    new(""),
				OazaCho: new(""),
				Chome:   new(""),
				Koaza:   new(""),
			},
			wantAddress:    "群馬県前橋市",
			wantHasPref:    true,
			wantHasCity:    true,
			wantHasOazaCho: false,
		},
		{
			name: "empty fields",
			sa: model.StructuredAddress{
				Pref:    new(""),
				County:  new(""),
				City:    new(""),
				Ward:    new(""),
				OazaCho: new(""),
				Chome:   new(""),
				Koaza:   new(""),
			},
			wantAddress:    "",
			wantHasPref:    false,
			wantHasCity:    false,
			wantHasOazaCho: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotAddress := model.FormatAddress(&tt.sa)
			if gotAddress != tt.wantAddress {
				t.Errorf("FormatAddress() = %q, want %q", gotAddress, tt.wantAddress)
			}

			hasPref := tt.sa.Pref != nil && *tt.sa.Pref != ""
			if hasPref != tt.wantHasPref {
				t.Errorf("hasPref = %v, want %v", hasPref, tt.wantHasPref)
			}

			hasCity := tt.sa.City != nil && *tt.sa.City != ""
			if hasCity != tt.wantHasCity {
				t.Errorf("hasCity = %v, want %v", hasCity, tt.wantHasCity)
			}

			hasOazaCho := tt.sa.OazaCho != nil && *tt.sa.OazaCho != ""
			if hasOazaCho != tt.wantHasOazaCho {
				t.Errorf("hasOazaCho = %v, want %v", hasOazaCho, tt.wantHasOazaCho)
			}
		})
	}
}

// TestBuildBaseIDs tests the repository.BuildBaseIDs function
func TestBuildBaseIDs(t *testing.T) {
	tests := []struct {
		name               string
		lgCode             string
		machiazaID         string
		rsdtAddrFlg        string
		wantHasLgCode      bool
		wantHasMachiazaID  bool
		wantHasRsdtAddrFlg bool
	}{
		{
			name:               "all fields",
			lgCode:             "131016",
			machiazaID:         "0001001",
			rsdtAddrFlg:        "1",
			wantHasLgCode:      true,
			wantHasMachiazaID:  true,
			wantHasRsdtAddrFlg: true,
		},
		{
			name:               "empty lgCode",
			lgCode:             "",
			machiazaID:         "0001001",
			rsdtAddrFlg:        "0",
			wantHasLgCode:      false,
			wantHasMachiazaID:  true,
			wantHasRsdtAddrFlg: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var rsdtAddrFlgPtr *string
			if tt.rsdtAddrFlg != "" {
				rsdtAddrFlgPtr = &tt.rsdtAddrFlg
			}
			ids := repository.BuildBaseIDs(tt.lgCode, tt.machiazaID, rsdtAddrFlgPtr)

			hasLgCode := ids.LgCode != nil && *ids.LgCode != ""
			if hasLgCode != tt.wantHasLgCode {
				t.Errorf("repository.BuildBaseIDs() hasLgCode = %v, want %v", hasLgCode, tt.wantHasLgCode)
			}

			hasMachiazaID := ids.MachiazaID != nil && *ids.MachiazaID != ""
			if hasMachiazaID != tt.wantHasMachiazaID {
				t.Errorf("repository.BuildBaseIDs() hasMachiazaID = %v, want %v", hasMachiazaID, tt.wantHasMachiazaID)
			}

			hasRsdtAddrFlg := ids.RsdtAddrFlg != nil
			if hasRsdtAddrFlg != tt.wantHasRsdtAddrFlg {
				t.Errorf("repository.BuildBaseIDs() hasRsdtAddrFlg = %v, want %v", hasRsdtAddrFlg, tt.wantHasRsdtAddrFlg)
			}
		})
	}
}

// TestBuildReverseFeature tests the buildReverseFeature helper function
func TestBuildReverseFeature(t *testing.T) {
	pref := "東京都"
	city := "千代田区"
	lgCode := "131016"

	sa := model.StructuredAddress{
		Pref: &pref,
		City: &city,
	}
	ids := model.IDs{
		LgCode: &lgCode,
	}

	feature := buildReverseFeature(sa, ids, 139.7530, 35.6940, 100.5)

	if feature.Type != "Feature" {
		t.Errorf("buildReverseFeature() Type = %v, want Feature", feature.Type)
	}

	if feature.Geometry.Type != "Point" {
		t.Errorf("buildReverseFeature() Geometry.Type = %v, want Point", feature.Geometry.Type)
	}

	if len(feature.Geometry.Coordinates) != 2 {
		t.Errorf("buildReverseFeature() Coordinates len = %d, want 2", len(feature.Geometry.Coordinates))
	}

	if feature.Geometry.Coordinates[0] != 139.7530 {
		t.Errorf("buildReverseFeature() Coordinates[0] = %v, want 139.7530", feature.Geometry.Coordinates[0])
	}

	if feature.Properties.Address != "東京都千代田区" {
		t.Errorf("buildReverseFeature() Address = %v, want 東京都千代田区", feature.Properties.Address)
	}

	if feature.Properties.Distance != 100.5 {
		t.Errorf("buildReverseFeature() Distance = %v, want 100.5", feature.Properties.Distance)
	}
}
