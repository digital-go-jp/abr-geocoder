package repository

import (
	"context"
	"math"
	"sync"
	"testing"

	"abrg/internal/cache"
	"abrg/internal/model"
)

// The tests in this file run the repository SQL against the committed
// quickstart cache (Tokyo, basic category, pos enabled) so that queries and
// scan code are exercised without a full nationwide cache. cache_rsdtdsp and
// cache_parcel exist but are empty in this cache, which pins the empty-result
// paths of the residential/parcel queries.
const quickstartCachePath = "../../../quickstart/tokyo_basic.duckdb"

// Kioicho, Chiyoda-ku in the quickstart cache. normalized_address stores the
// search-normalized form where kanji numerals are converted to digits
// (千代田区 → 1000代田区).
const (
	kioichoAddr       = "1000代田区紀尾井町"
	chiyodaLgCode     = "131016"
	kioichoMachiazaID = "0056000"
	kioichoLon        = 139.734955
	kioichoLat        = 35.681412
)

var initTestRepo = sync.OnceValues(func() (*DB, error) {
	c, err := cache.NewDuckDBCacheFromPath(context.Background(), quickstartCachePath)
	if err != nil {
		return nil, err
	}
	return NewRepository(c.DB()), nil
})

// setupRepo opens the quickstart cache. The file is tracked in Git, so a
// failure to open it is a real regression and fails the test instead of
// skipping.
func setupRepo(t *testing.T) *DB {
	t.Helper()
	repo, err := initTestRepo()
	if err != nil {
		t.Fatalf("open quickstart cache %s: %v", quickstartCachePath, err)
	}
	return repo
}

func almostEqual(got, want float64) bool {
	return math.Abs(got-want) < 1e-4
}

func TestFindBasicByAddress(t *testing.T) {
	repo := setupRepo(t)
	ctx := context.Background()

	t.Run("exact match with prefecture filter", func(t *testing.T) {
		results, err := repo.FindBasicByAddress(ctx, BasicSearchParams{Address: kioichoAddr, PrefCode: "13", Limit: 5})
		if err != nil {
			t.Fatalf("FindBasicByAddress() error = %v", err)
		}
		if len(results) != 1 {
			t.Fatalf("FindBasicByAddress() returned %d results, want 1", len(results))
		}
		r := results[0]
		if r.LgCode != chiyodaLgCode || r.MachiazaID != kioichoMachiazaID {
			t.Errorf("LgCode/MachiazaID = %q/%q, want %q/%q", r.LgCode, r.MachiazaID, chiyodaLgCode, kioichoMachiazaID)
		}
		if r.Pref != "東京都" || r.City != "千代田区" {
			t.Errorf("Pref/City = %q/%q, want 東京都/千代田区", r.Pref, r.City)
		}
		if r.OazaCho == nil || *r.OazaCho != "紀尾井町" {
			t.Errorf("OazaCho = %v, want 紀尾井町", r.OazaCho)
		}
		if r.HasChome {
			t.Error("HasChome = true, want false")
		}
		if r.Lon == nil || r.Lat == nil || !almostEqual(*r.Lon, kioichoLon) || !almostEqual(*r.Lat, kioichoLat) {
			t.Errorf("Lon/Lat = %v/%v, want ~%f/~%f", r.Lon, r.Lat, kioichoLon, kioichoLat)
		}
	})

	t.Run("prefecture filter excludes other prefectures", func(t *testing.T) {
		results, err := repo.FindBasicByAddress(ctx, BasicSearchParams{Address: kioichoAddr, PrefCode: "14", Limit: 5})
		if err != nil {
			t.Fatalf("FindBasicByAddress() error = %v", err)
		}
		if len(results) != 0 {
			t.Errorf("FindBasicByAddress() returned %d results, want 0", len(results))
		}
	})

	t.Run("pref all disables the filter", func(t *testing.T) {
		results, err := repo.FindBasicByAddress(ctx, BasicSearchParams{Address: kioichoAddr, PrefCode: model.All, Limit: 5})
		if err != nil {
			t.Fatalf("FindBasicByAddress() error = %v", err)
		}
		if len(results) != 1 {
			t.Errorf("FindBasicByAddress() returned %d results, want 1", len(results))
		}
	})

	t.Run("no match returns empty slice", func(t *testing.T) {
		results, err := repo.FindBasicByAddress(ctx, BasicSearchParams{Address: "存在しない町", PrefCode: "13", Limit: 5})
		if err != nil {
			t.Fatalf("FindBasicByAddress() error = %v", err)
		}
		if len(results) != 0 {
			t.Errorf("FindBasicByAddress() returned %d results, want 0", len(results))
		}
	})
}

func TestFindBasicByLevenshtein(t *testing.T) {
	repo := setupRepo(t)
	ctx := context.Background()

	t.Run("near match ranks exact row first", func(t *testing.T) {
		results, err := repo.FindBasicByLevenshtein(ctx, LevenshteinParams{SearchAddr: "1000代田区紀尾井丁", PrefCode: "13", Limit: 3})
		if err != nil {
			t.Fatalf("FindBasicByLevenshtein() error = %v", err)
		}
		if len(results) == 0 {
			t.Fatal("FindBasicByLevenshtein() returned no results")
		}
		if results[0].MachiazaID != kioichoMachiazaID || results[0].LgCode != chiyodaLgCode {
			t.Errorf("first result = %q/%q, want %q/%q",
				results[0].LgCode, results[0].MachiazaID, chiyodaLgCode, kioichoMachiazaID)
		}
	})

	t.Run("lg_code and machiaza_id prefix filter", func(t *testing.T) {
		results, err := repo.FindBasicByLevenshtein(ctx, LevenshteinParams{
			SearchAddr: kioichoAddr, LgCode: chiyodaLgCode, MachiazaID: kioichoMachiazaID, Limit: 3,
		})
		if err != nil {
			t.Fatalf("FindBasicByLevenshtein() error = %v", err)
		}
		if len(results) == 0 {
			t.Fatal("FindBasicByLevenshtein() returned no results")
		}
		for _, r := range results {
			if r.LgCode != chiyodaLgCode {
				t.Errorf("result LgCode = %q, want %q", r.LgCode, chiyodaLgCode)
			}
			if r.MachiazaID[:4] != kioichoMachiazaID[:4] {
				t.Errorf("result MachiazaID = %q, want prefix %q", r.MachiazaID, kioichoMachiazaID[:4])
			}
		}
	})

	t.Run("distance beyond threshold returns empty", func(t *testing.T) {
		results, err := repo.FindBasicByLevenshtein(ctx, LevenshteinParams{SearchAddr: "あいうえおかきくけこ", PrefCode: "13", Limit: 3})
		if err != nil {
			t.Fatalf("FindBasicByLevenshtein() error = %v", err)
		}
		if len(results) != 0 {
			t.Errorf("FindBasicByLevenshtein() returned %d results, want 0", len(results))
		}
	})
}

func TestFindBasicByPrefix(t *testing.T) {
	repo := setupRepo(t)
	ctx := context.Background()

	t.Run("db address prefix of base address", func(t *testing.T) {
		results, err := repo.FindBasicByPrefix(ctx, PrefixParams{BaseAddr: kioichoAddr + "103", PrefCode: "13", Limit: 3})
		if err != nil {
			t.Fatalf("FindBasicByPrefix() error = %v", err)
		}
		if len(results) == 0 {
			t.Fatal("FindBasicByPrefix() returned no results")
		}
		if results[0].MachiazaID != kioichoMachiazaID {
			t.Errorf("first result MachiazaID = %q, want %q", results[0].MachiazaID, kioichoMachiazaID)
		}
	})

	t.Run("no prefix match returns empty", func(t *testing.T) {
		results, err := repo.FindBasicByPrefix(ctx, PrefixParams{BaseAddr: "該当なし", PrefCode: "13", Limit: 3})
		if err != nil {
			t.Fatalf("FindBasicByPrefix() error = %v", err)
		}
		if len(results) != 0 {
			t.Errorf("FindBasicByPrefix() returned %d results, want 0", len(results))
		}
	})
}

func TestFindCityByAddress(t *testing.T) {
	repo := setupRepo(t)
	ctx := context.Background()

	t.Run("by lg_code includes coordinates", func(t *testing.T) {
		result, err := repo.FindCityByAddress(ctx, CitySearchParams{LgCode: chiyodaLgCode})
		if err != nil {
			t.Fatalf("FindCityByAddress() error = %v", err)
		}
		if result == nil {
			t.Fatal("FindCityByAddress() = nil, want result")
		}
		if result.City != "千代田区" || result.Pref != "東京都" {
			t.Errorf("City/Pref = %q/%q, want 千代田区/東京都", result.City, result.Pref)
		}
		if result.Lon == nil || result.Lat == nil {
			t.Errorf("Lon/Lat = %v/%v, want coordinates", result.Lon, result.Lat)
		}
	})

	t.Run("by normalized address with prefecture filter", func(t *testing.T) {
		result, err := repo.FindCityByAddress(ctx, CitySearchParams{CityAddr: "1000代田区", PrefCode: "13"})
		if err != nil {
			t.Fatalf("FindCityByAddress() error = %v", err)
		}
		if result == nil || result.LgCode != chiyodaLgCode {
			t.Errorf("FindCityByAddress() = %+v, want LgCode %q", result, chiyodaLgCode)
		}
	})

	t.Run("no match returns nil without error", func(t *testing.T) {
		result, err := repo.FindCityByAddress(ctx, CitySearchParams{LgCode: "999999"})
		if err != nil {
			t.Fatalf("FindCityByAddress() error = %v", err)
		}
		if result != nil {
			t.Errorf("FindCityByAddress() = %+v, want nil", result)
		}
	})
}

func TestFindCityRecord(t *testing.T) {
	repo := setupRepo(t)
	ctx := context.Background()

	t.Run("longest prefix match", func(t *testing.T) {
		result, err := repo.FindCityRecord(ctx, CityRecordParams{CityPart: kioichoAddr, PrefCode: "13"})
		if err != nil {
			t.Fatalf("FindCityRecord() error = %v", err)
		}
		if result == nil || result.LgCode != chiyodaLgCode {
			t.Errorf("FindCityRecord() = %+v, want LgCode %q", result, chiyodaLgCode)
		}
	})

	t.Run("no match returns nil without error", func(t *testing.T) {
		result, err := repo.FindCityRecord(ctx, CityRecordParams{CityPart: "該当なし", PrefCode: "13"})
		if err != nil {
			t.Fatalf("FindCityRecord() error = %v", err)
		}
		if result != nil {
			t.Errorf("FindCityRecord() = %+v, want nil", result)
		}
	})
}

func TestFindCityRecordFuzzy(t *testing.T) {
	repo := setupRepo(t)
	ctx := context.Background()

	t.Run("fuzzy match within edit distance", func(t *testing.T) {
		result, err := repo.FindCityRecordFuzzy(ctx, CityFuzzyParams{CityPart: "1000代田図", PrefCode: "13", MaxEditDistance: 3})
		if err != nil {
			t.Fatalf("FindCityRecordFuzzy() error = %v", err)
		}
		if result == nil || result.LgCode != chiyodaLgCode {
			t.Errorf("FindCityRecordFuzzy() = %+v, want LgCode %q", result, chiyodaLgCode)
		}
	})

	t.Run("empty prefecture code returns nil without querying", func(t *testing.T) {
		result, err := repo.FindCityRecordFuzzy(ctx, CityFuzzyParams{CityPart: "1000代田区", PrefCode: "", MaxEditDistance: 3})
		if err != nil {
			t.Fatalf("FindCityRecordFuzzy() error = %v", err)
		}
		if result != nil {
			t.Errorf("FindCityRecordFuzzy() = %+v, want nil", result)
		}
	})

	t.Run("pref all returns nil without querying", func(t *testing.T) {
		result, err := repo.FindCityRecordFuzzy(ctx, CityFuzzyParams{CityPart: "1000代田区", PrefCode: model.All, MaxEditDistance: 3})
		if err != nil {
			t.Fatalf("FindCityRecordFuzzy() error = %v", err)
		}
		if result != nil {
			t.Errorf("FindCityRecordFuzzy() = %+v, want nil", result)
		}
	})
}

func TestFindPrefecture(t *testing.T) {
	repo := setupRepo(t)
	ctx := context.Background()

	t.Run("tokyo", func(t *testing.T) {
		result, err := repo.FindPrefecture(ctx, "13")
		if err != nil {
			t.Fatalf("FindPrefecture() error = %v", err)
		}
		if result == nil || result.LgCode != "130001" || result.PrefName != "東京都" {
			t.Errorf("FindPrefecture() = %+v, want LgCode 130001 / PrefName 東京都", result)
		}
	})

	t.Run("unknown code returns nil without error", func(t *testing.T) {
		result, err := repo.FindPrefecture(ctx, "99")
		if err != nil {
			t.Fatalf("FindPrefecture() error = %v", err)
		}
		if result != nil {
			t.Errorf("FindPrefecture() = %+v, want nil", result)
		}
	})
}

func TestCoordinates(t *testing.T) {
	repo := setupRepo(t)
	ctx := context.Background()

	t.Run("machiaza level", func(t *testing.T) {
		coords, level := repo.Coordinates(ctx, chiyodaLgCode, kioichoMachiazaID)
		if coords == nil {
			t.Fatal("Coordinates() = nil, want coordinates")
		}
		if level != model.MatchLevelMachiaza {
			t.Errorf("Coordinates() level = %q, want %q", level, model.MatchLevelMachiaza)
		}
		if !almostEqual(coords[0], kioichoLon) || !almostEqual(coords[1], kioichoLat) {
			t.Errorf("Coordinates() = %v, want ~[%f %f]", coords, kioichoLon, kioichoLat)
		}
	})

	t.Run("city fallback without machiaza id", func(t *testing.T) {
		coords, level := repo.Coordinates(ctx, chiyodaLgCode, "")
		if coords == nil {
			t.Fatal("Coordinates() = nil, want coordinates")
		}
		if level != model.MatchLevelCity {
			t.Errorf("Coordinates() level = %q, want %q", level, model.MatchLevelCity)
		}
	})

	t.Run("city fallback for unknown machiaza id", func(t *testing.T) {
		coords, level := repo.Coordinates(ctx, chiyodaLgCode, "9999999")
		if coords == nil {
			t.Fatal("Coordinates() = nil, want coordinates")
		}
		if level != model.MatchLevelCity {
			t.Errorf("Coordinates() level = %q, want %q", level, model.MatchLevelCity)
		}
	})

	t.Run("prefecture fallback for unknown city", func(t *testing.T) {
		coords, level := repo.Coordinates(ctx, "139999", "")
		if coords == nil {
			t.Fatal("Coordinates() = nil, want coordinates")
		}
		if level != model.MatchLevelPrefecture {
			t.Errorf("Coordinates() level = %q, want %q", level, model.MatchLevelPrefecture)
		}
	})

	t.Run("unknown prefecture returns nil", func(t *testing.T) {
		coords, level := repo.Coordinates(ctx, "999999", "")
		if coords != nil || level != "" {
			t.Errorf("Coordinates() = %v, %q, want nil, empty", coords, level)
		}
	})
}

func TestFindResidentialBestMatch_EmptyTable(t *testing.T) {
	repo := setupRepo(t)
	ctx := context.Background()

	filters := []ResidentialFilter{
		{BlkNum: "1"},
		{BlkNum: "1", RsdtNum: "2"},
		{BlkNum: "1", RsdtNum: "2", RsdtNum2: "3"},
	}
	for _, filter := range filters {
		result, err := repo.FindResidentialBestMatch(ctx, chiyodaLgCode, kioichoMachiazaID, filter)
		if err != nil {
			t.Fatalf("FindResidentialBestMatch(%+v) error = %v", filter, err)
		}
		if result != nil {
			t.Errorf("FindResidentialBestMatch(%+v) = %+v, want nil", filter, result)
		}
	}
}

func TestFindParcelExact_EmptyTable(t *testing.T) {
	repo := setupRepo(t)
	ctx := context.Background()

	filters := []ParcelFilter{
		{PrcNum1: "1"},
		{PrcNum1: "1", PrcNum2: "2"},
		{PrcNum1: "1", PrcNum2: "2", PrcNum3: "3"},
	}
	for _, filter := range filters {
		result, err := repo.FindParcelExact(ctx, chiyodaLgCode, kioichoMachiazaID, filter)
		if err != nil {
			t.Fatalf("FindParcelExact(%+v) error = %v", filter, err)
		}
		if result != nil {
			t.Errorf("FindParcelExact(%+v) = %+v, want nil", filter, result)
		}
	}
}

func TestFindNearestBasic(t *testing.T) {
	repo := setupRepo(t)
	ctx := context.Background()

	t.Run("nearest to kioicho point", func(t *testing.T) {
		results, err := repo.FindNearestBasic(ctx, SpatialParams{Lon: kioichoLon, Lat: kioichoLat, Limit: 3, Radius: 0.009})
		if err != nil {
			t.Fatalf("FindNearestBasic() error = %v", err)
		}
		if len(results) == 0 {
			t.Fatal("FindNearestBasic() returned no results")
		}
		first := results[0]
		if first.LgCode != chiyodaLgCode || first.MachiazaID != kioichoMachiazaID {
			t.Errorf("first result = %q/%q, want %q/%q", first.LgCode, first.MachiazaID, chiyodaLgCode, kioichoMachiazaID)
		}
		if first.Distance > 1.0 {
			t.Errorf("first result Distance = %f, want < 1.0", first.Distance)
		}
	})

	t.Run("prefecture filter excludes results", func(t *testing.T) {
		results, err := repo.FindNearestBasic(ctx, SpatialParams{Lon: kioichoLon, Lat: kioichoLat, Limit: 3, Pref: "14", Radius: 0.009})
		if err != nil {
			t.Fatalf("FindNearestBasic() error = %v", err)
		}
		if len(results) != 0 {
			t.Errorf("FindNearestBasic() returned %d results, want 0", len(results))
		}
	})

	t.Run("invalid prefecture code is an error", func(t *testing.T) {
		_, err := repo.FindNearestBasic(ctx, SpatialParams{Lon: kioichoLon, Lat: kioichoLat, Limit: 3, Pref: "abc", Radius: 0.009})
		if err == nil {
			t.Error("FindNearestBasic() error = nil, want error")
		}
	})
}

func TestFindNearestResidential_EmptyTable(t *testing.T) {
	repo := setupRepo(t)

	results, err := repo.FindNearestResidential(context.Background(), SpatialParams{Lon: kioichoLon, Lat: kioichoLat, Limit: 3, Radius: 0.009})
	if err != nil {
		t.Fatalf("FindNearestResidential() error = %v", err)
	}
	if len(results) != 0 {
		t.Errorf("FindNearestResidential() returned %d results, want 0", len(results))
	}
}

func TestFindNearestParcel_EmptyTable(t *testing.T) {
	repo := setupRepo(t)

	results, err := repo.FindNearestParcel(context.Background(), SpatialParams{Lon: kioichoLon, Lat: kioichoLat, Limit: 3, Radius: 0.009})
	if err != nil {
		t.Fatalf("FindNearestParcel() error = %v", err)
	}
	if len(results) != 0 {
		t.Errorf("FindNearestParcel() returned %d results, want 0", len(results))
	}
}
