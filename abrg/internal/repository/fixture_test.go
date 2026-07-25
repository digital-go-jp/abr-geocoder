package repository

import (
	"context"
	"testing"

	"abr.local/common/duck"

	"abrg/internal/schema"
)

// The tests in this file run the residential/parcel queries against a small
// in-memory DuckDB built from schema.InitSchemaSQL with hand-inserted rows,
// so the row scan paths (NULL conversion, match conditions, match levels) are
// exercised with actual data. The quickstart cache cannot cover these because
// its cache_rsdtdsp and cache_parcel tables are empty.

const (
	fixtureLgCode     = "131016"
	fixtureMachiazaID = "0001000"
)

func newFixtureRepo(t *testing.T) *DB {
	t.Helper()
	ctx := context.Background()

	db, err := duck.Open("")
	if err != nil {
		t.Fatalf("open in-memory duckdb: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	if err := duck.LoadExtension(ctx, db, "spatial"); err != nil {
		t.Fatalf("load spatial extension: %v", err)
	}

	initSQL, err := schema.InitSchemaSQL()
	if err != nil {
		t.Fatalf("generate schema SQL: %v", err)
	}
	if _, err := db.ExecContext(ctx, initSQL); err != nil {
		t.Fatalf("init schema: %v", err)
	}

	fixtures := []string{
		`INSERT INTO cache_machiaza
			(pref_code, lg_code, machiaza_id, rsdt_addr_flg, pref, county, city, ward,
			 kyoto_st, oaza_cho, chome, koaza, machiaza_dist, wake_num_flg,
			 normalized_address, has_chome, parcel_count, rsdtdsp_count, geom)
		 VALUES (13, '131016', '0001000', 1, '東京都', NULL, '千代田区', NULL,
			 NULL, '紀尾井町', NULL, NULL, NULL, 0,
			 '1000代田区紀尾井町', FALSE, 3, 3, ST_Point(139.7350, 35.6814))`,
		// Block-only row, then rows with rsdt_num and rsdt_num2, each slightly
		// farther from the fixture point so distance ordering is deterministic.
		`INSERT INTO cache_rsdtdsp
			(pref_code, lg_code, machiaza_id, blk_id, rsdt_id, rsdt2_id, blk_num, rsdt_num, rsdt_num2, geom)
		 VALUES
			(13, '131016', '0001000', '001', NULL, NULL, '1', NULL, NULL, ST_Point(139.7351, 35.6814)),
			(13, '131016', '0001000', '001', '002', NULL, '1', '2', NULL, ST_Point(139.7352, 35.6814)),
			(13, '131016', '0001000', '001', '002', '00003', '1', '2', '3', ST_Point(139.7353, 35.6814))`,
		`INSERT INTO cache_parcel
			(pref_code, lg_code, machiaza_id, prc_id, prc_num1, prc_num2, prc_num3, geom)
		 VALUES
			(13, '131016', '0001000', '000000010', '10', NULL, NULL, ST_Point(139.7351, 35.6814)),
			(13, '131016', '0001000', '000000010000002', '10', '2', NULL, ST_Point(139.7352, 35.6814)),
			(13, '131016', '0001000', '000000010000002000003', '10', '2', '3', ST_Point(139.7353, 35.6814))`,
	}
	for _, stmt := range fixtures {
		if _, err := db.ExecContext(ctx, stmt); err != nil {
			t.Fatalf("insert fixture: %v", err)
		}
	}

	return NewRepository(db)
}

func strVal(p *string) string {
	if p == nil {
		return "<nil>"
	}
	return *p
}

func TestFindResidentialBestMatch_Fixture(t *testing.T) {
	repo := newFixtureRepo(t)
	ctx := context.Background()

	t.Run("block only filter matches block row", func(t *testing.T) {
		result, err := repo.FindResidentialBestMatch(ctx, fixtureLgCode, fixtureMachiazaID, ResidentialFilter{BlkNum: "1"})
		if err != nil {
			t.Fatalf("FindResidentialBestMatch() error = %v", err)
		}
		if result == nil {
			t.Fatal("FindResidentialBestMatch() = nil, want block row")
		}
		if result.MatchLevel != MatchLevelBlk {
			t.Errorf("MatchLevel = %d, want %d", result.MatchLevel, MatchLevelBlk)
		}
		if strVal(result.BlkID) != "001" || strVal(result.BlkNum) != "1" {
			t.Errorf("BlkID/BlkNum = %s/%s, want 001/1", strVal(result.BlkID), strVal(result.BlkNum))
		}
		if result.RsdtID != nil || result.RsdtNum != nil || result.Rsdt2ID != nil || result.RsdtNum2 != nil {
			t.Errorf("rsdt fields = %s/%s/%s/%s, want all nil",
				strVal(result.RsdtID), strVal(result.RsdtNum), strVal(result.Rsdt2ID), strVal(result.RsdtNum2))
		}
		if result.Lon == nil || result.Lat == nil || !almostEqual(*result.Lon, 139.7351) || !almostEqual(*result.Lat, 35.6814) {
			t.Errorf("Lon/Lat = %v/%v, want ~139.7351/~35.6814", result.Lon, result.Lat)
		}
	})

	t.Run("rsdt_num filter prefers rsdt row over block row", func(t *testing.T) {
		result, err := repo.FindResidentialBestMatch(ctx, fixtureLgCode, fixtureMachiazaID, ResidentialFilter{BlkNum: "1", RsdtNum: "2"})
		if err != nil {
			t.Fatalf("FindResidentialBestMatch() error = %v", err)
		}
		if result == nil {
			t.Fatal("FindResidentialBestMatch() = nil, want rsdt row")
		}
		if result.MatchLevel != MatchLevelRsdt {
			t.Errorf("MatchLevel = %d, want %d", result.MatchLevel, MatchLevelRsdt)
		}
		if strVal(result.RsdtID) != "002" || strVal(result.RsdtNum) != "2" {
			t.Errorf("RsdtID/RsdtNum = %s/%s, want 002/2", strVal(result.RsdtID), strVal(result.RsdtNum))
		}
		if result.Rsdt2ID != nil || result.RsdtNum2 != nil {
			t.Errorf("Rsdt2ID/RsdtNum2 = %s/%s, want nil", strVal(result.Rsdt2ID), strVal(result.RsdtNum2))
		}
	})

	t.Run("rsdt_num2 filter prefers full match", func(t *testing.T) {
		result, err := repo.FindResidentialBestMatch(ctx, fixtureLgCode, fixtureMachiazaID, ResidentialFilter{BlkNum: "1", RsdtNum: "2", RsdtNum2: "3"})
		if err != nil {
			t.Fatalf("FindResidentialBestMatch() error = %v", err)
		}
		if result == nil {
			t.Fatal("FindResidentialBestMatch() = nil, want rsdt2 row")
		}
		if result.MatchLevel != MatchLevelRsdt2 {
			t.Errorf("MatchLevel = %d, want %d", result.MatchLevel, MatchLevelRsdt2)
		}
		if strVal(result.Rsdt2ID) != "00003" || strVal(result.RsdtNum2) != "3" {
			t.Errorf("Rsdt2ID/RsdtNum2 = %s/%s, want 00003/3", strVal(result.Rsdt2ID), strVal(result.RsdtNum2))
		}
	})

	t.Run("unknown block number returns nil", func(t *testing.T) {
		result, err := repo.FindResidentialBestMatch(ctx, fixtureLgCode, fixtureMachiazaID, ResidentialFilter{BlkNum: "9"})
		if err != nil {
			t.Fatalf("FindResidentialBestMatch() error = %v", err)
		}
		if result != nil {
			t.Errorf("FindResidentialBestMatch() = %+v, want nil", result)
		}
	})

	t.Run("other machiaza returns nil", func(t *testing.T) {
		result, err := repo.FindResidentialBestMatch(ctx, fixtureLgCode, "9999999", ResidentialFilter{BlkNum: "1"})
		if err != nil {
			t.Fatalf("FindResidentialBestMatch() error = %v", err)
		}
		if result != nil {
			t.Errorf("FindResidentialBestMatch() = %+v, want nil", result)
		}
	})
}

func TestFindParcelExact_Fixture(t *testing.T) {
	repo := newFixtureRepo(t)
	ctx := context.Background()

	t.Run("prc_num1 only matches row with NULL rest", func(t *testing.T) {
		result, err := repo.FindParcelExact(ctx, fixtureLgCode, fixtureMachiazaID, ParcelFilter{PrcNum1: "10"})
		if err != nil {
			t.Fatalf("FindParcelExact() error = %v", err)
		}
		if result == nil {
			t.Fatal("FindParcelExact() = nil, want prc_num1-only row")
		}
		if strVal(result.PrcID) != "000000010" || strVal(result.PrcNum1) != "10" {
			t.Errorf("PrcID/PrcNum1 = %s/%s, want 000000010/10", strVal(result.PrcID), strVal(result.PrcNum1))
		}
		if result.PrcNum2 != nil || result.PrcNum3 != nil {
			t.Errorf("PrcNum2/PrcNum3 = %s/%s, want nil", strVal(result.PrcNum2), strVal(result.PrcNum3))
		}
		if result.Lon == nil || result.Lat == nil || !almostEqual(*result.Lon, 139.7351) {
			t.Errorf("Lon/Lat = %v/%v, want ~139.7351/~35.6814", result.Lon, result.Lat)
		}
	})

	t.Run("prc_num2 filter matches two-part row", func(t *testing.T) {
		result, err := repo.FindParcelExact(ctx, fixtureLgCode, fixtureMachiazaID, ParcelFilter{PrcNum1: "10", PrcNum2: "2"})
		if err != nil {
			t.Fatalf("FindParcelExact() error = %v", err)
		}
		if result == nil {
			t.Fatal("FindParcelExact() = nil, want two-part row")
		}
		if strVal(result.PrcNum2) != "2" || result.PrcNum3 != nil {
			t.Errorf("PrcNum2/PrcNum3 = %s/%s, want 2/nil", strVal(result.PrcNum2), strVal(result.PrcNum3))
		}
	})

	t.Run("prc_num3 filter matches three-part row", func(t *testing.T) {
		result, err := repo.FindParcelExact(ctx, fixtureLgCode, fixtureMachiazaID, ParcelFilter{PrcNum1: "10", PrcNum2: "2", PrcNum3: "3"})
		if err != nil {
			t.Fatalf("FindParcelExact() error = %v", err)
		}
		if result == nil {
			t.Fatal("FindParcelExact() = nil, want three-part row")
		}
		if strVal(result.PrcNum3) != "3" {
			t.Errorf("PrcNum3 = %s, want 3", strVal(result.PrcNum3))
		}
	})

	t.Run("unknown parcel number returns nil", func(t *testing.T) {
		result, err := repo.FindParcelExact(ctx, fixtureLgCode, fixtureMachiazaID, ParcelFilter{PrcNum1: "99"})
		if err != nil {
			t.Fatalf("FindParcelExact() error = %v", err)
		}
		if result != nil {
			t.Errorf("FindParcelExact() = %+v, want nil", result)
		}
	})
}

func TestFindNearestResidential_Fixture(t *testing.T) {
	repo := newFixtureRepo(t)
	ctx := context.Background()

	results, err := repo.FindNearestResidential(ctx, SpatialParams{Lon: 139.7350, Lat: 35.6814, Limit: 3, Radius: 0.009})
	if err != nil {
		t.Fatalf("FindNearestResidential() error = %v", err)
	}
	if len(results) != 3 {
		t.Fatalf("FindNearestResidential() returned %d results, want 3", len(results))
	}

	// Ordered by distance: block-only row is closest.
	first := results[0]
	if first.LgCode != fixtureLgCode || first.MachiazaID != fixtureMachiazaID {
		t.Errorf("first LgCode/MachiazaID = %q/%q, want %q/%q", first.LgCode, first.MachiazaID, fixtureLgCode, fixtureMachiazaID)
	}
	if strVal(first.BlkNum) != "1" || first.RsdtNum != nil || first.RsdtNum2 != nil {
		t.Errorf("first BlkNum/RsdtNum/RsdtNum2 = %s/%s/%s, want 1/nil/nil",
			strVal(first.BlkNum), strVal(first.RsdtNum), strVal(first.RsdtNum2))
	}
	// Base fields come from the cache_machiaza LEFT JOIN.
	if first.Pref != "東京都" || first.City != "千代田区" || strVal(first.OazaCho) != "紀尾井町" {
		t.Errorf("first Pref/City/OazaCho = %q/%q/%s, want 東京都/千代田区/紀尾井町", first.Pref, first.City, strVal(first.OazaCho))
	}
	if first.County != nil || first.Ward != nil {
		t.Errorf("first County/Ward = %s/%s, want nil", strVal(first.County), strVal(first.Ward))
	}
	if strVal(first.RsdtAddrFlg) != "1" {
		t.Errorf("first RsdtAddrFlg = %s, want 1", strVal(first.RsdtAddrFlg))
	}

	last := results[2]
	if strVal(last.RsdtNum2) != "3" {
		t.Errorf("last RsdtNum2 = %s, want 3 (farthest fixture row)", strVal(last.RsdtNum2))
	}
	if !(results[0].Distance <= results[1].Distance && results[1].Distance <= results[2].Distance) {
		t.Errorf("distances not ascending: %f, %f, %f", results[0].Distance, results[1].Distance, results[2].Distance)
	}
}

func TestFindNearestParcel_Fixture(t *testing.T) {
	repo := newFixtureRepo(t)
	ctx := context.Background()

	results, err := repo.FindNearestParcel(ctx, SpatialParams{Lon: 139.7350, Lat: 35.6814, Limit: 3, Radius: 0.009})
	if err != nil {
		t.Fatalf("FindNearestParcel() error = %v", err)
	}
	if len(results) != 3 {
		t.Fatalf("FindNearestParcel() returned %d results, want 3", len(results))
	}

	first := results[0]
	if strVal(first.PrcNum1) != "10" || first.PrcNum2 != nil || first.PrcNum3 != nil {
		t.Errorf("first PrcNum1/2/3 = %s/%s/%s, want 10/nil/nil",
			strVal(first.PrcNum1), strVal(first.PrcNum2), strVal(first.PrcNum3))
	}
	if first.Pref != "東京都" || first.City != "千代田区" || strVal(first.OazaCho) != "紀尾井町" {
		t.Errorf("first Pref/City/OazaCho = %q/%q/%s, want 東京都/千代田区/紀尾井町", first.Pref, first.City, strVal(first.OazaCho))
	}

	last := results[2]
	if strVal(last.PrcNum3) != "3" {
		t.Errorf("last PrcNum3 = %s, want 3 (farthest fixture row)", strVal(last.PrcNum3))
	}
	if !(results[0].Distance <= results[1].Distance && results[1].Distance <= results[2].Distance) {
		t.Errorf("distances not ascending: %f, %f, %f", results[0].Distance, results[1].Distance, results[2].Distance)
	}
}
