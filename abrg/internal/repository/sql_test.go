package repository

import (
	"context"
	"sync"
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/cache"
	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// The tests in this file run against the committed quickstart cache (Tokyo,
// basic category, pos enabled). It has no cache_rsdtdsp or cache_parcel:
// fixture_test.go covers those queries, and requests for categories a cache
// lacks are rejected before they reach the repository.
const quickstartCachePath = "../../../quickstart/tokyo_basic.duckdb"

// Kioicho, Chiyoda-ku in the quickstart cache. normalized_address has kanji
// numerals converted to digits (千代田区 → 1000代田区).
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

// setupRepo opens the quickstart cache. The file is tracked in Git, so failing
// to open it fails the test.
func setupRepo(t *testing.T) *DB {
	t.Helper()
	repo, err := initTestRepo()
	if err != nil {
		t.Fatalf("open quickstart cache %s: %v", quickstartCachePath, err)
	}
	return repo
}

// storedFloat reports whether got is want as a FLOAT column stores it, with no
// further rounding on the way out.
func storedFloat(got, want float64) bool {
	return got == float64(float32(want))
}

// storedCoordinates reads lon and lat of the first row of table matching where,
// bypassing the repository's queries.
func storedCoordinates(t *testing.T, repo *DB, table, where string, args ...any) []float64 {
	t.Helper()
	var lon, lat float32
	query := "SELECT lon, lat FROM " + table + " WHERE " + where + " LIMIT 1"
	if err := repo.db.QueryRowContext(context.Background(), query, args...).Scan(&lon, &lat); err != nil {
		t.Fatalf("query %s: %v", query, err)
	}
	return []float64{float64(lon), float64(lat)}
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
		if r.Lon == nil || r.Lat == nil || !storedFloat(*r.Lon, kioichoLon) || !storedFloat(*r.Lat, kioichoLat) {
			t.Errorf("Lon/Lat = %v/%v, want %v/%v", r.Lon, r.Lat, float64(float32(kioichoLon)), float64(float32(kioichoLat)))
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
		want := storedCoordinates(t, repo, "cache_city", "lg_code = ?", chiyodaLgCode)
		if result.Lon == nil || result.Lat == nil || *result.Lon != want[0] || *result.Lat != want[1] {
			t.Errorf("Lon/Lat = %v/%v, want %v", result.Lon, result.Lat, want)
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

func TestFindCandidateLgCodes(t *testing.T) {
	repo := setupRepo(t)
	ctx := context.Background()

	t.Run("misspelled city name without a prefecture", func(t *testing.T) {
		codes, err := repo.FindCandidateLgCodes(ctx, CityFuzzyParams{CityPart: "1000代田区", MaxEditDistance: 3})
		if err != nil {
			t.Fatalf("FindCandidateLgCodes() error = %v", err)
		}
		if len(codes) == 0 || codes[0] != chiyodaLgCode {
			t.Errorf("FindCandidateLgCodes() = %v, want %q first", codes, chiyodaLgCode)
		}
	})

	t.Run("name matching no city returns nothing", func(t *testing.T) {
		codes, err := repo.FindCandidateLgCodes(ctx, CityFuzzyParams{CityPart: "ヨクワカラナイ市", MaxEditDistance: 3})
		if err != nil {
			t.Fatalf("FindCandidateLgCodes() error = %v", err)
		}
		if len(codes) != 0 {
			t.Errorf("FindCandidateLgCodes() = %v, want none", codes)
		}
	})

	t.Run("candidates stay within the cap", func(t *testing.T) {
		codes, err := repo.FindCandidateLgCodes(ctx, CityFuzzyParams{CityPart: "区", MaxEditDistance: 30})
		if err != nil {
			t.Fatalf("FindCandidateLgCodes() error = %v", err)
		}
		if len(codes) > maxCandidateLgCodes {
			t.Errorf("FindCandidateLgCodes() returned %d codes, want at most %d", len(codes), maxCandidateLgCodes)
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
		if !storedFloat(coords[0], kioichoLon) || !storedFloat(coords[1], kioichoLat) {
			t.Errorf("Coordinates() = %v, want [%v %v]", coords, float64(float32(kioichoLon)), float64(float32(kioichoLat)))
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
		if want := storedCoordinates(t, repo, "cache_city", "lg_code = ?", chiyodaLgCode); coords[0] != want[0] || coords[1] != want[1] {
			t.Errorf("Coordinates() = %v, want %v", coords, want)
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
		if want := storedCoordinates(t, repo, "cache_city", "lg_code = ?", chiyodaLgCode); coords[0] != want[0] || coords[1] != want[1] {
			t.Errorf("Coordinates() = %v, want %v", coords, want)
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
		if want := storedCoordinates(t, repo, "cache_pref", "pref_code = ?", "13"); coords[0] != want[0] || coords[1] != want[1] {
			t.Errorf("Coordinates() = %v, want %v", coords, want)
		}
	})

	t.Run("prefecture by its lg_code", func(t *testing.T) {
		coords, level := repo.Coordinates(ctx, "130001", "")
		if coords == nil {
			t.Fatal("Coordinates() = nil, want coordinates")
		}
		if level != model.MatchLevelPrefecture {
			t.Errorf("Coordinates() level = %q, want %q", level, model.MatchLevelPrefecture)
		}
		if want := storedCoordinates(t, repo, "cache_pref", "lg_code = ?", "130001"); coords[0] != want[0] || coords[1] != want[1] {
			t.Errorf("Coordinates() = %v, want %v", coords, want)
		}
	})

	t.Run("unknown prefecture returns nil", func(t *testing.T) {
		coords, level := repo.Coordinates(ctx, "999999", "")
		if coords != nil || level != "" {
			t.Errorf("Coordinates() = %v, %q, want nil, empty", coords, level)
		}
	})
}

func TestFindNearestBasic(t *testing.T) {
	repo := setupRepo(t)
	ctx := context.Background()

	t.Run("nearest to kioicho point", func(t *testing.T) {
		results, err := repo.FindNearestBasic(ctx, SpatialParams{Lon: kioichoLon, Lat: kioichoLat, Limit: 3, Radius: 1000})
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
		if !storedFloat(first.Lon, kioichoLon) || !storedFloat(first.Lat, kioichoLat) {
			t.Errorf("first result Lon/Lat = %v/%v, want %v/%v", first.Lon, first.Lat, float64(float32(kioichoLon)), float64(float32(kioichoLat)))
		}
		if first.Distance > 1.0 {
			t.Errorf("first result Distance = %f, want < 1.0", first.Distance)
		}
	})

	t.Run("prefecture filter excludes results", func(t *testing.T) {
		results, err := repo.FindNearestBasic(ctx, SpatialParams{Lon: kioichoLon, Lat: kioichoLat, Limit: 3, Pref: "14", Radius: 1000})
		if err != nil {
			t.Fatalf("FindNearestBasic() error = %v", err)
		}
		if len(results) != 0 {
			t.Errorf("FindNearestBasic() returned %d results, want 0", len(results))
		}
	})

	t.Run("invalid prefecture code is an error", func(t *testing.T) {
		_, err := repo.FindNearestBasic(ctx, SpatialParams{Lon: kioichoLon, Lat: kioichoLat, Limit: 3, Pref: "abc", Radius: 1000})
		if err == nil {
			t.Error("FindNearestBasic() error = nil, want error")
		}
	})
}
