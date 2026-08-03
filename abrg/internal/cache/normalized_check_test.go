package cache

import (
	"context"
	"strconv"
	"strings"
	"testing"

	"abrg/internal/infra/duckdb"
	"abrg/internal/schema"
)

// Normalization rewrites kanji numerals, so these fixtures use place names
// that contain none and therefore normalize to themselves. That keeps the
// expected normalized_address readable in the SQL below.
const (
	seedPrefSQL = `INSERT INTO cache_pref (pref_code, lg_code, pref, normalized_address)
		VALUES (13, '130001', '東京都', '東京都')`
	seedCitySQL = `INSERT INTO cache_city (pref_code, lg_code, pref, county, city, ward, normalized_address)
		VALUES (13, '131032', '東京都', NULL, '港区', NULL, '港区')`
	seedMachiazaSQL = `INSERT INTO cache_machiaza (pref_code, lg_code, machiaza_id, pref, county, city, ward, kyoto_st, oaza_cho, chome, koaza, normalized_address)
		VALUES (13, '131032', '0004000', '東京都', NULL, '港区', NULL, NULL, '赤坂', NULL, NULL, '港区赤坂')`
)

func normalizationFixture(t *testing.T, extraSQL ...string) string {
	t.Helper()
	current, err := schema.Version()
	if err != nil {
		t.Fatalf("schema.Version(): %v", err)
	}
	config := map[string]string{
		KeySchemaVersion:   strconv.Itoa(current),
		"enabled_category": "basic",
	}
	return newTestCacheFile(t, config, append([]string{seedPrefSQL, seedCitySQL, seedMachiazaSQL}, extraSQL...)...)
}

func TestNewDuckDBCacheFromPath_NormalizationCheck(t *testing.T) {
	ctx := context.Background()

	t.Run("consistent cache opens", func(t *testing.T) {
		c, err := NewDuckDBCacheFromPath(ctx, normalizationFixture(t))
		if err != nil {
			t.Fatalf("NewDuckDBCacheFromPath() error = %v, want nil", err)
		}
		_ = c.Close()
	})

	t.Run("stale machiaza value is rejected", func(t *testing.T) {
		path := normalizationFixture(t, `INSERT INTO cache_machiaza
			(pref_code, lg_code, machiaza_id, pref, city, oaza_cho, normalized_address)
			VALUES (13, '131032', '0005000', '東京都', '港区', '飯田橋', '港区飯田橋X')`)

		_, err := NewDuckDBCacheFromPath(ctx, path)
		if err == nil {
			t.Fatal("NewDuckDBCacheFromPath() = nil, want error")
		}
		for _, want := range []string{
			"cache_machiaza",
			"1 row",
			"lg_code=131032",
			"machiaza_id=0005000",
			"abrg cache build",
		} {
			if !strings.Contains(err.Error(), want) {
				t.Errorf("error %q does not contain %q", err, want)
			}
		}
	})

	t.Run("stale city value is rejected", func(t *testing.T) {
		path := normalizationFixture(t, `INSERT INTO cache_city
			(pref_code, lg_code, pref, city, normalized_address)
			VALUES (13, '131024', '東京都', '中央区', '中央区X')`)

		_, err := NewDuckDBCacheFromPath(ctx, path)
		if err == nil {
			t.Fatal("NewDuckDBCacheFromPath() = nil, want error")
		}
		if !strings.Contains(err.Error(), "cache_city") {
			t.Errorf("error %q does not name the table", err)
		}
	})

	t.Run("stale pref value is rejected", func(t *testing.T) {
		path := normalizationFixture(t, `INSERT INTO cache_pref
			(pref_code, lg_code, pref, normalized_address)
			VALUES (14, '140007', '神奈川県', '神奈川県X')`)

		_, err := NewDuckDBCacheFromPath(ctx, path)
		if err == nil {
			t.Fatal("NewDuckDBCacheFromPath() = nil, want error")
		}
		if !strings.Contains(err.Error(), "cache_pref") {
			t.Errorf("error %q does not name the table", err)
		}
	})

	// A NULL stored value against a non-NULL recomputation is the case <>
	// silently drops, so this pins the use of IS DISTINCT FROM.
	t.Run("null stored value is rejected", func(t *testing.T) {
		path := normalizationFixture(t, `INSERT INTO cache_machiaza
			(pref_code, lg_code, machiaza_id, pref, city, oaza_cho, normalized_address)
			VALUES (13, '131032', '0006000', '東京都', '港区', '飯田橋', NULL)`)

		_, err := NewDuckDBCacheFromPath(ctx, path)
		if err == nil {
			t.Fatal("NewDuckDBCacheFromPath() = nil, want error")
		}
		if !strings.Contains(err.Error(), "cache_machiaza") {
			t.Errorf("error %q does not name the table", err)
		}
	})

	// kyoto_st precedes oaza_cho. A row concatenated the other way round must
	// be caught, which pins the column order rather than just the column set.
	t.Run("machiaza column order is pinned", func(t *testing.T) {
		path := normalizationFixture(t, `INSERT INTO cache_machiaza
			(pref_code, lg_code, machiaza_id, pref, city, kyoto_st, oaza_cho, normalized_address)
			VALUES (26, '261041', '0010000', '京都府', '京都市中京区', '押小路通', '東入', '京都市中京区東入押小路通')`)

		_, err := NewDuckDBCacheFromPath(ctx, path)
		if err == nil {
			t.Fatal("NewDuckDBCacheFromPath() = nil, want error: kyoto_st must precede oaza_cho")
		}
	})
}

func TestNormalizationCheck_NotAppliedToCLIEntryPoint(t *testing.T) {
	path := normalizationFixture(t, `INSERT INTO cache_machiaza
		(pref_code, lg_code, machiaza_id, pref, city, oaza_cho, normalized_address)
		VALUES (13, '131032', '0007000', '東京都', '港区', '飯田橋', '港区飯田橋X')`)

	t.Setenv(duckdb.EnvCachePath, path)

	c, err := NewDuckDBCache(t.Context())
	if err != nil {
		t.Fatalf("NewDuckDBCache() error = %v, want nil: the CLI path must not verify", err)
	}
	_ = c.Close()
}
