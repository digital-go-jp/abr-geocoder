package cache

import (
	"fmt"
	"strings"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/util"
)

// SQL constants for data insertion from PostgreSQL to DuckDB cache.
//
// The category tables (cache_rsdtdsp, cache_parcel) exist only when
// enabled_category includes them. They are created by CTAS here, not by
// cache_schema.yaml, so their whole DDL lives in this file.
//
// The category tables have no indexes. Their rows are ordered by lg_code and
// machiaza_id, which lets DuckDB skip row groups when filtering by those columns
// or by the lon / lat range of a reverse search.
//
// Coordinates are FLOAT, the type abrdb imports them as by default.

// dropCategoryTablesSQL removes category tables from a previous build, so a
// category table exists only if the current build created it.
const dropCategoryTablesSQL = `
DROP TABLE IF EXISTS cache_rsdtdsp;
DROP TABLE IF EXISTS cache_parcel;
`

// insertMachiazaSQLTemplate inserts cache_machiaza rows and must run after the
// category tables are built. Counts come from CTEs with LEFT JOIN, which is
// faster than correlated subqueries. The count CTE bodies are placeholders,
// filled by buildInsertMachiazaSQL, because the category tables may not exist.
const insertMachiazaSQLTemplate = `
WITH
parcel_cnt AS (
	{{parcel_cnt}}
),
rsdt_cnt AS (
	{{rsdt_cnt}}
),
oaza_has_chome AS (
	SELECT lg_code, oaza_cho, TRUE AS has_any_chome
	FROM pg.public.mt_town_unified
	WHERE chome IS NOT NULL
	GROUP BY lg_code, oaza_cho
)
INSERT INTO cache_machiaza (pref_code, lg_code, machiaza_id, rsdt_addr_flg, pref, county, city, ward, kyoto_st, oaza_cho, chome, koaza, machiaza_dist, wake_num_flg, normalized_address, has_chome, parcel_count, rsdtdsp_count, lon, lat)
SELECT
	CAST(SUBSTR(t.lg_code, 1, 2) AS SMALLINT) AS pref_code,
	t.lg_code,
	t.machiaza_id,
	t.rsdt_addr_flg::SMALLINT,
	p.pref,
	c.county,
	c.city,
	c.ward,
	CASE WHEN t.koaza_aka_code = 2 THEN t.koaza ELSE NULL END AS kyoto_st,
	t.oaza_cho,
	t.chome,
	CASE WHEN t.koaza_aka_code = 2 THEN NULL ELSE t.koaza END AS koaza,
	t.machiaza_dist,
	t.wake_num_flg::SMALLINT,
	{{normalized_address}} AS normalized_address,
	-- has_chome: true if:
	-- 1. This record has chome set, OR
	-- 2. oaza_cho itself contains 丁目 (e.g., 下田市の二丁目), OR
	-- 3. Any record with same (lg_code, oaza_cho) has chome (pre-aggregated in oaza_has_chome CTE)
	(
		t.chome IS NOT NULL
		OR t.oaza_cho LIKE '%丁目'
		OR COALESCE(oh.has_any_chome, FALSE)
	) AS has_chome,
	COALESCE(pc.parcel_count, 0) AS parcel_count,
	COALESCE(rc.rsdtdsp_count, 0) AS rsdtdsp_count,
	CAST(t.rep_lon AS FLOAT) AS lon,
	CAST(t.rep_lat AS FLOAT) AS lat
FROM pg.public.mt_pref_unified p
JOIN pg.public.mt_city_unified c ON SUBSTR(p.lg_code, 1, 2) = SUBSTR(c.lg_code, 1, 2)
JOIN pg.public.mt_town_unified t ON c.lg_code = t.lg_code
LEFT JOIN parcel_cnt pc ON pc.lg_code = t.lg_code AND pc.machiaza_id = t.machiaza_id
LEFT JOIN rsdt_cnt rc ON rc.lg_code = t.lg_code AND rc.machiaza_id = t.machiaza_id
LEFT JOIN oaza_has_chome oh ON oh.lg_code = t.lg_code AND oh.oaza_cho = t.oaza_cho
`

// machiazaCountCTE returns the aggregation CTE body counting rows of a
// category table per machiaza, or an empty relation of the same shape when
// the table is not part of this build (the LEFT JOIN then yields NULL and
// COALESCE stores 0).
func machiazaCountCTE(table, countCol string, exists bool) string {
	if !exists {
		return fmt.Sprintf("SELECT NULL::VARCHAR AS lg_code, NULL::VARCHAR AS machiaza_id, NULL::INTEGER AS %s WHERE FALSE", countCol)
	}
	return fmt.Sprintf(`SELECT lg_code, machiaza_id, COUNT(*)::INTEGER AS %s
	FROM %s
	GROUP BY lg_code, machiaza_id`, countCol, table)
}

// buildInsertMachiazaSQL returns the machiaza insert SQL for a build that has
// (or has not) each category table.
func buildInsertMachiazaSQL(hasRsdtdsp, hasParcel bool) string {
	return strings.NewReplacer(
		"{{parcel_cnt}}", machiazaCountCTE("cache_parcel", "parcel_count", hasParcel),
		"{{rsdt_cnt}}", machiazaCountCTE("cache_rsdtdsp", "rsdtdsp_count", hasRsdtdsp),
		"{{normalized_address}}", buildNormalizedExpr(machiazaNormalizedParts),
	).Replace(insertMachiazaSQLTemplate)
}

// insertCitySQLTemplate inserts cache_city rows from PostgreSQL.
const insertCitySQLTemplate = `
INSERT INTO cache_city (pref_code, lg_code, pref, county, city, ward, normalized_address, lon, lat)
SELECT
	CAST(SUBSTR(c.lg_code, 1, 2) AS SMALLINT) AS pref_code,
	c.lg_code,
	p.pref,
	c.county,
	c.city,
	c.ward,
	{{normalized_address}} AS normalized_address,
	CAST(c.rep_lon AS FLOAT) AS lon,
	CAST(c.rep_lat AS FLOAT) AS lat
FROM pg.public.mt_pref_unified p
JOIN pg.public.mt_city_unified c ON SUBSTR(p.lg_code, 1, 2) = SUBSTR(c.lg_code, 1, 2)
`

// insertPrefSQLTemplate inserts cache_pref rows from PostgreSQL.
const insertPrefSQLTemplate = `
INSERT INTO cache_pref (pref_code, lg_code, pref, normalized_address, lon, lat)
SELECT
	CAST(SUBSTR(p.lg_code, 1, 2) AS SMALLINT) AS pref_code,
	p.lg_code,
	p.pref,
	{{normalized_address}} AS normalized_address,
	CAST(p.rep_lon AS FLOAT) AS lon,
	CAST(p.rep_lat AS FLOAT) AS lat
FROM pg.public.mt_pref_unified p
`

// buildInsertSQL fills a template's normalized_address placeholder with the
// expression shared with the open-time check.
func buildInsertSQL(template string, parts []normalizedPart) string {
	return strings.Replace(template, "{{normalized_address}}", buildNormalizedExpr(parts), 1)
}

// createRsdtdspSQL creates cache_rsdtdsp from PostgreSQL.
const createRsdtdspSQL = `
CREATE OR REPLACE TABLE cache_rsdtdsp AS
SELECT * FROM (
	-- Block only data
	SELECT
		CAST(SUBSTR(b.lg_code, 1, 2) AS SMALLINT) AS pref_code,
		b.lg_code,
		b.machiaza_id,
		b.blk_id,
		NULL AS rsdt_id,
		NULL AS rsdt2_id,
		b.blk_num,
		NULL AS rsdt_num,
		NULL AS rsdt_num2,
		CAST(b.rep_lon AS FLOAT) AS lon,
		CAST(b.rep_lat AS FLOAT) AS lat
	FROM pg.public.mt_town_unified t
	INNER JOIN pg.public.mt_rsdtdsp_blk_unified b ON t.lg_code = b.lg_code AND t.machiaza_id = b.machiaza_id
	WHERE t.rsdt_addr_flg = 1

	UNION ALL

	-- Block + Residential inner join data
	SELECT
		CAST(SUBSTR(r.lg_code, 1, 2) AS SMALLINT) AS pref_code,
		r.lg_code,
		r.machiaza_id,
		r.blk_id,
		r.rsdt_id,
		r.rsdt2_id,
		b.blk_num,
		r.rsdt_num,
		r.rsdt_num2,
		CAST(r.rep_lon AS FLOAT) AS lon,
		CAST(r.rep_lat AS FLOAT) AS lat
	FROM pg.public.mt_town_unified t
	INNER JOIN pg.public.mt_rsdtdsp_blk_unified b ON t.lg_code = b.lg_code AND t.machiaza_id = b.machiaza_id
	INNER JOIN pg.public.mt_rsdtdsp_rsdt_unified r ON b.lg_code = r.lg_code AND b.machiaza_id = r.machiaza_id AND b.blk_id = r.blk_id
	WHERE t.rsdt_addr_flg = 1
) ORDER BY lg_code, machiaza_id
`

// widenKatakana renders the SQL that turns the half-width katakana ABR writes a
// parcel number in into the full-width form every other table uses.
func widenKatakana(col string) string {
	return fmt.Sprintf("translate(%s, '%s', '%s')", col, util.HalfWidthKatakana, util.FullWidthKatakana)
}

// createParcelSQL creates cache_parcel from PostgreSQL.
var createParcelSQL = fmt.Sprintf(`
CREATE OR REPLACE TABLE cache_parcel AS
SELECT
	CAST(SUBSTR(prc.lg_code, 1, 2) AS SMALLINT) AS pref_code,
	prc.lg_code,
	prc.machiaza_id,
	prc.prc_id,
	%s AS prc_num1,
	%s AS prc_num2,
	%s AS prc_num3,
	CAST(prc.rep_lon AS FLOAT) AS lon,
	CAST(prc.rep_lat AS FLOAT) AS lat
FROM pg.public.mt_parcel_unified prc
ORDER BY prc.lg_code, prc.machiaza_id
`, widenKatakana("prc.prc_num1"), widenKatakana("prc.prc_num2"), widenKatakana("prc.prc_num3"))
