CREATE TABLE IF NOT EXISTS "pref" (
  "lg_code" TEXT,
  "pref_name" TEXT,
  "pref_name_kana" TEXT,
  "pref_name_roma" TEXT,
  "efct_date" TEXT,
  "ablt_date" TEXT,
  "remarks" TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS "pref_code" ON "pref" ("lg_code");

CREATE TABLE IF NOT EXISTS "city" (
  "lg_code" TEXT,
  "pref_name" TEXT,
  "pref_name_kana" TEXT,
  "pref_name_roma" TEXT,
  "county_name" TEXT,
  "county_name_kana" TEXT,
  "county_name_roma" TEXT,
  "city_name" TEXT,
  "city_name_kana" TEXT,
  "city_name_roma" TEXT,
  "od_city_name" TEXT,
  "od_city_name_kana" TEXT,
  "od_city_name_roma" TEXT,
  "efct_date" TEXT,
  "ablt_date" TEXT,
  "remarks" TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS "city_code" ON "city" ("lg_code");

CREATE TABLE IF NOT EXISTS "town" (
  "lg_code" TEXT,
  "town_id" TEXT,
  "town_code" TEXT,
  "pref_name" TEXT,
  "pref_name_kana" TEXT,
  "pref_name_roma" TEXT,
  "county_name" TEXT,
  "county_name_kana" TEXT,
  "county_name_roma" TEXT,
  "city_name" TEXT,
  "city_name_kana" TEXT,
  "city_name_roma" TEXT,
  "od_city_name" TEXT,
  "od_city_name_kana" TEXT,
  "od_city_name_roma" TEXT,
  "oaza_town_name" TEXT,
  "oaza_town_name_kana" TEXT,
  "oaza_town_name_roma" TEXT,
  "chome_name" TEXT,
  "chome_name_kana" TEXT,
  "chome_name_number" TEXT,
  "koaza_name" TEXT,
  "koaza_name_kana" TEXT,
  "koaza_name_roma" TEXT,
  "rsdt_addr_flg" TEXT,
  "rsdt_addr_mtd_code" TEXT,
  "oaza_town_alt_name_flg" TEXT,
  "koaza_alt_name_flg" TEXT,
  "oaza_frn_ltrs_flg" TEXT,
  "koaza_frn_ltrs_flg" TEXT,
  "status_flg" TEXT,
  "wake_num_flg" TEXT,
  "efct_date" TEXT,
  "ablt_date" TEXT,
  "src_code" TEXT,
  "post_code" TEXT,
  "remarks" TEXT,

  -- mt_town_pos_prefXX から結合
  "rep_pnt_lon" REAL DEFAULT null,
  "rep_pnt_lat" REAL DEFAULT null
);

CREATE UNIQUE INDEX IF NOT EXISTS "town_code" ON "town" ("lg_code", "town_id");

CREATE TABLE IF NOT EXISTS "rsdtdsp_blk" (
  "lg_code" TEXT,
  "town_id" TEXT,
  "blk_id" TEXT,
  "city_name" TEXT,
  "od_city_name" TEXT,
  "oaza_town_name" TEXT,
  "chome_name" TEXT,
  "koaza_name" TEXT,
  "blk_num" TEXT,
  "rsdt_addr_flg" TEXT,
  "rsdt_addr_mtd_code" TEXT,
  "oaza_frn_ltrs_flg" TEXT,
  "koaza_frn_ltrs_flg" TEXT,
  "status_flg" TEXT,
  "efct_date" TEXT,
  "ablt_date" TEXT,
  "src_code" TEXT,
  "remarks" TEXT,

  -- mt_rsdtdsp_blk_pos_prefXX から結合
  "rep_pnt_lon" REAL,
  "rep_pnt_lat" REAL
);

CREATE UNIQUE INDEX IF NOT EXISTS "rsdtdsp_blk_code" ON "rsdtdsp_blk" ("lg_code", "town_id", "blk_id");

CREATE TABLE IF NOT EXISTS "rsdtdsp_rsdt" (
  "lg_code" TEXT,
  "town_id" TEXT,
  "blk_id" TEXT,
  "addr_id" TEXT,
  "addr2_id" TEXT,
  "city_name" TEXT,
  "od_city_name" TEXT,
  "oaza_town_name" TEXT,
  "chome_name" TEXT,
  "koaza_name" TEXT,
  "blk_num" TEXT,
  "rsdt_num" TEXT,
  "rsdt_num2" TEXT,
  "basic_rsdt_div" TEXT,
  "rsdt_addr_flg" TEXT,
  "rsdt_addr_mtd_code" TEXT,
  "oaza_frn_ltrs_flg" TEXT,
  "koaza_frn_ltrs_flg" TEXT,
  "status_flg" TEXT,
  "efct_date" TEXT,
  "ablt_date" TEXT,
  "src_code" TEXT,
  "remarks" TEXT,

  -- mt_rsdtdsp_rsdt_pos_prefXX から結合
  "rep_pnt_lon" REAL,
  "rep_pnt_lat" REAL
);

CREATE UNIQUE INDEX IF NOT EXISTS "rsdtdsp_rsdt_code" ON "rsdtdsp_rsdt" (
  "lg_code", "town_id", "blk_id", "addr_id", "addr2_id"
);

CREATE TABLE IF NOT EXISTS "metadata" (
  "key" TEXT,
  "value" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "metadata_key" ON "metadata" ("key");
