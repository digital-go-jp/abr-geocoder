package cache

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"

	"abr.local/common/duck"

	"abrg/internal/infra/duckdb"
)

// The tests in this file run the real build SQL (CTAS, machiaza insert,
// indexes, config save) for every enabled_category against a small in-memory
// database attached as pg, mirroring the mt_* columns the build reads. This
// pins that single-category builds work without the tables of the other
// categories existing.

// fakePGSourceSQL creates the attached pg database schema with one city
// (131016), one residential machiaza (0001000, rsdt_addr_flg=1, one block)
// and one parcel machiaza (0002000, rsdt_addr_flg=0, one parcel).
const fakePGSourceSQL = `
CREATE SCHEMA pg.public;
CREATE TABLE pg.public.mt_pref_unified (lg_code VARCHAR, pref VARCHAR, rep_lon DOUBLE, rep_lat DOUBLE);
CREATE TABLE pg.public.mt_city_unified (lg_code VARCHAR, county VARCHAR, city VARCHAR, ward VARCHAR, rep_lon DOUBLE, rep_lat DOUBLE);
CREATE TABLE pg.public.mt_town_unified (
	lg_code VARCHAR, machiaza_id VARCHAR, rsdt_addr_flg INTEGER, koaza_aka_code INTEGER,
	oaza_cho VARCHAR, chome VARCHAR, koaza VARCHAR, machiaza_dist VARCHAR, wake_num_flg INTEGER,
	rep_lon DOUBLE, rep_lat DOUBLE);
CREATE TABLE pg.public.mt_rsdtdsp_blk_unified (
	lg_code VARCHAR, machiaza_id VARCHAR, blk_id VARCHAR, blk_num VARCHAR, rep_lon DOUBLE, rep_lat DOUBLE);
CREATE TABLE pg.public.mt_rsdtdsp_rsdt_unified (
	lg_code VARCHAR, machiaza_id VARCHAR, blk_id VARCHAR, rsdt_id VARCHAR, rsdt2_id VARCHAR,
	rsdt_num VARCHAR, rsdt_num2 VARCHAR, rep_lon DOUBLE, rep_lat DOUBLE);
CREATE TABLE pg.public.mt_parcel_unified (
	lg_code VARCHAR, machiaza_id VARCHAR, prc_id VARCHAR,
	prc_num1 VARCHAR, prc_num2 VARCHAR, prc_num3 VARCHAR, rep_lon DOUBLE, rep_lat DOUBLE);

INSERT INTO pg.public.mt_pref_unified VALUES ('130001', '東京都', 139.6917, 35.6895);
INSERT INTO pg.public.mt_city_unified VALUES ('131016', NULL, '千代田区', NULL, 139.7536, 35.6940);
INSERT INTO pg.public.mt_town_unified VALUES
	('131016', '0001000', 1, 0, '紀尾井町', NULL, NULL, NULL, 0, 139.7350, 35.6814),
	('131016', '0002000', 0, 0, '北の丸公園', NULL, NULL, NULL, 0, 139.7530, 35.6910);
INSERT INTO pg.public.mt_rsdtdsp_blk_unified VALUES ('131016', '0001000', '001', '1', 139.7351, 35.6814);
INSERT INTO pg.public.mt_rsdtdsp_rsdt_unified VALUES ('131016', '0001000', '001', '002', NULL, '2', NULL, 139.7352, 35.6814);
INSERT INTO pg.public.mt_parcel_unified VALUES ('131016', '0002000', '000000010', '10', NULL, NULL, 139.7531, 35.6910);
`

// newCategoryBuildCache runs the build pipeline for the given category into a
// fresh cache file and returns a read connection to the result.
func newCategoryBuildCache(t *testing.T, category string) (string, *sql.DB) {
	t.Helper()
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), category+".duckdb")

	conn, err := duckdb.Open(path)
	if err != nil {
		t.Fatalf("open duckdb: %v", err)
	}
	t.Cleanup(func() { _ = conn.Close() })

	if err := duck.LoadExtension(ctx, conn, "spatial"); err != nil {
		t.Fatalf("load spatial extension: %v", err)
	}
	if err := registerUDF(ctx, conn); err != nil {
		t.Fatalf("register UDF: %v", err)
	}
	if err := initSchema(ctx, conn); err != nil {
		t.Fatalf("init schema: %v", err)
	}
	if _, err := conn.ExecContext(ctx, "ATTACH ':memory:' AS pg"); err != nil {
		t.Fatalf("attach fake pg: %v", err)
	}
	if _, err := conn.ExecContext(ctx, fakePGSourceSQL); err != nil {
		t.Fatalf("create fake pg source: %v", err)
	}

	cfg := &Config{DBVersion: "test", EnabledPref: "13", EnabledCategory: category, EnabledPos: "true"}
	if err := buildCacheTables(ctx, conn, cfg, make(map[string]float64)); err != nil {
		t.Fatalf("buildCacheTables(%s): %v", category, err)
	}
	if _, err := conn.ExecContext(ctx, "DETACH pg"); err != nil {
		t.Fatalf("detach fake pg: %v", err)
	}
	return path, conn
}

func TestBuildCacheTables_Categories(t *testing.T) {
	ctx := context.Background()

	tests := []struct {
		category    string
		wantRsdtdsp bool
		wantParcel  bool
	}{
		{"basic", false, false},
		{"rsdtdsp", true, false},
		{"parcel", false, true},
		{"all", true, true},
	}

	for _, tt := range tests {
		t.Run("category "+tt.category, func(t *testing.T) {
			path, conn := newCategoryBuildCache(t, tt.category)

			for table, want := range map[string]bool{
				duckdb.TableRsdtdsp: tt.wantRsdtdsp,
				duckdb.TableParcel:  tt.wantParcel,
			} {
				got, err := tableExists(ctx, conn, table)
				if err != nil {
					t.Fatalf("tableExists(%s): %v", table, err)
				}
				if got != want {
					t.Errorf("table %s exists = %v, want %v", table, got, want)
				}
			}

			// The machiaza counts reflect only the categories that were built:
			// the residential machiaza has 2 rsdtdsp rows (block-only row plus
			// block+rsdt row), the parcel machiaza has 1 parcel row.
			wantCount := func(built bool, rows int) int {
				if built {
					return rows
				}
				return 0
			}
			var rsdtdspCount, parcelCount int
			if err := conn.QueryRowContext(ctx,
				"SELECT rsdtdsp_count, parcel_count FROM cache_machiaza WHERE machiaza_id = '0001000'").
				Scan(&rsdtdspCount, &parcelCount); err != nil {
				t.Fatalf("read machiaza counts: %v", err)
			}
			if want := wantCount(tt.wantRsdtdsp, 2); rsdtdspCount != want {
				t.Errorf("rsdtdsp_count = %d, want %d", rsdtdspCount, want)
			}
			if parcelCount != 0 {
				t.Errorf("parcel_count of residential machiaza = %d, want 0", parcelCount)
			}
			if err := conn.QueryRowContext(ctx,
				"SELECT parcel_count FROM cache_machiaza WHERE machiaza_id = '0002000'").
				Scan(&parcelCount); err != nil {
				t.Fatalf("read parcel machiaza count: %v", err)
			}
			if want := wantCount(tt.wantParcel, 1); parcelCount != want {
				t.Errorf("parcel_count = %d, want %d", parcelCount, want)
			}

			// The built cache passes the open-time version and integrity
			// checks. The build connection must close first: a read-only open
			// cannot coexist with the read-write one.
			if err := conn.Close(); err != nil {
				t.Fatalf("close build connection: %v", err)
			}
			c, err := NewDuckDBCacheFromPath(ctx, path)
			if err != nil {
				t.Fatalf("open built cache: %v", err)
			}
			_ = c.Close()
		})
	}
}
