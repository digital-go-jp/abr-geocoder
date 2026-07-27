package cache

// SQL constants for data insertion from PostgreSQL to DuckDB cache.
//
// The category tables (cache_rsdtdsp / cache_parcel) exist only in caches
// whose enabled_category includes them. They are created by the CTAS
// statements below rather than by cache_schema.yaml, so their whole DDL
// (table shape, spatial indexes, cleanup of stale copies) lives in this file.

// dropCategoryTablesSQL removes category tables left over from a previous
// build so that a category table exists if and only if the current build
// created it.
const dropCategoryTablesSQL = `
DROP TABLE IF EXISTS cache_rsdtdsp;
DROP TABLE IF EXISTS cache_parcel;
`

// Note: No index on (lg_code, machiaza_id) for the category tables - Row
// Group statistics from the CTAS ORDER BY provide sufficient filtering.
const createRsdtdspIndexSQL = `CREATE INDEX IF NOT EXISTS idx_rsdtdsp_geom ON cache_rsdtdsp USING RTREE(geom)`

const createParcelIndexSQL = `CREATE INDEX IF NOT EXISTS idx_parcel_geom ON cache_parcel USING RTREE(geom)`

// insertMachiazaSQL inserts town/machiaza-level data from PostgreSQL.
// This should be called AFTER cache_parcel and cache_rsdtdsp are populated.
// Uses CTE + LEFT JOIN instead of correlated subqueries for better performance.
const insertMachiazaSQL = `
WITH
parcel_cnt AS (
	SELECT lg_code, machiaza_id, COUNT(*)::INTEGER AS parcel_count
	FROM cache_parcel
	GROUP BY lg_code, machiaza_id
),
rsdt_cnt AS (
	SELECT lg_code, machiaza_id, COUNT(*)::INTEGER AS rsdtdsp_count
	FROM cache_rsdtdsp
	GROUP BY lg_code, machiaza_id
),
oaza_has_chome AS (
	SELECT lg_code, oaza_cho, TRUE AS has_any_chome
	FROM pg.public.mt_town_unified
	WHERE chome IS NOT NULL
	GROUP BY lg_code, oaza_cho
)
INSERT INTO cache_machiaza (pref_code, lg_code, machiaza_id, rsdt_addr_flg, pref, county, city, ward, kyoto_st, oaza_cho, chome, koaza, machiaza_dist, wake_num_flg, normalized_address, has_chome, parcel_count, rsdtdsp_count, geom)
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
	normalize_text_go(CONCAT_WS('', c.county, c.city, c.ward, CASE WHEN t.koaza_aka_code = 2 THEN t.koaza ELSE NULL END, t.oaza_cho, t.chome, CASE WHEN t.koaza_aka_code = 2 THEN NULL ELSE t.koaza END)) AS normalized_address,
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
	ST_Point(t.rep_lon, t.rep_lat) AS geom
FROM pg.public.mt_pref_unified p
JOIN pg.public.mt_city_unified c ON SUBSTR(p.lg_code, 1, 2) = SUBSTR(c.lg_code, 1, 2)
JOIN pg.public.mt_town_unified t ON c.lg_code = t.lg_code
LEFT JOIN parcel_cnt pc ON pc.lg_code = t.lg_code AND pc.machiaza_id = t.machiaza_id
LEFT JOIN rsdt_cnt rc ON rc.lg_code = t.lg_code AND rc.machiaza_id = t.machiaza_id
LEFT JOIN oaza_has_chome oh ON oh.lg_code = t.lg_code AND oh.oaza_cho = t.oaza_cho
`

// insertCitySQL inserts city-level data from PostgreSQL.
const insertCitySQL = `
INSERT INTO cache_city (pref_code, lg_code, pref, county, city, ward, normalized_address, geom)
SELECT
	CAST(SUBSTR(c.lg_code, 1, 2) AS SMALLINT) AS pref_code,
	c.lg_code,
	p.pref,
	c.county,
	c.city,
	c.ward,
	normalize_text_go(CONCAT_WS('', c.county, c.city, c.ward)) AS normalized_address,
	ST_Point(c.rep_lon, c.rep_lat) AS geom
FROM pg.public.mt_pref_unified p
JOIN pg.public.mt_city_unified c ON SUBSTR(p.lg_code, 1, 2) = SUBSTR(c.lg_code, 1, 2)
`

// insertPrefSQL inserts prefecture-level data from PostgreSQL.
const insertPrefSQL = `
INSERT INTO cache_pref (pref_code, lg_code, pref, normalized_address, geom)
SELECT
	CAST(SUBSTR(p.lg_code, 1, 2) AS SMALLINT) AS pref_code,
	p.lg_code,
	p.pref,
	normalize_text_go(p.pref) AS normalized_address,
	ST_Point(p.rep_lon, p.rep_lat) AS geom
FROM pg.public.mt_pref_unified p
`

// createRsdtdspSQL creates rsdtdsp (residential) table from PostgreSQL.
// Uses CREATE TABLE AS SELECT ... ORDER BY to ensure DuckDB Row Group statistics
// are properly set for lg_code/machiaza_id filtering optimization.
// This reduces query time from ~60ms to ~6ms by allowing DuckDB to skip irrelevant Row Groups.
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
		ST_Point(b.rep_lon, b.rep_lat) AS geom
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
		ST_Point(r.rep_lon, r.rep_lat) AS geom
	FROM pg.public.mt_town_unified t
	INNER JOIN pg.public.mt_rsdtdsp_blk_unified b ON t.lg_code = b.lg_code AND t.machiaza_id = b.machiaza_id
	INNER JOIN pg.public.mt_rsdtdsp_rsdt_unified r ON b.lg_code = r.lg_code AND b.machiaza_id = r.machiaza_id AND b.blk_id = r.blk_id
	WHERE t.rsdt_addr_flg = 1
) ORDER BY lg_code, machiaza_id
`

// createParcelSQL creates parcel (land lot) table from PostgreSQL.
// Uses CREATE TABLE AS SELECT ... ORDER BY to ensure DuckDB Row Group statistics
// are properly set for lg_code/machiaza_id filtering optimization.
const createParcelSQL = `
CREATE OR REPLACE TABLE cache_parcel AS
SELECT
	CAST(SUBSTR(prc.lg_code, 1, 2) AS SMALLINT) AS pref_code,
	prc.lg_code,
	prc.machiaza_id,
	prc.prc_id,
	prc.prc_num1,
	prc.prc_num2,
	prc.prc_num3,
	ST_Point(prc.rep_lon, prc.rep_lat) AS geom
FROM pg.public.mt_parcel_unified prc
ORDER BY prc.lg_code, prc.machiaza_id
`
