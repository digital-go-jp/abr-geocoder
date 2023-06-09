CREATE TABLE IF NOT EXISTS "pref" (
  "code" TEXT,
  "都道府県名" TEXT,
  "都道府県名_カナ" TEXT,
  "都道府県名_英字" TEXT,
  "効力発生日" TEXT,
  "廃止日" TEXT,
  "備考" TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS "pref_code" ON "pref" ("code");

CREATE TABLE IF NOT EXISTS "city" (
  "code" TEXT,
  "都道府県名" TEXT,
  "都道府県名_カナ" TEXT,
  "都道府県名_英字" TEXT,
  "郡名" TEXT,
  "郡名_カナ" TEXT,
  "郡名_英字" TEXT,
  "市区町村名" TEXT,
  "市区町村名_カナ" TEXT,
  "市区町村名_英字" TEXT,
  "政令市区名" TEXT,
  "政令市区名_カナ" TEXT,
  "政令市区名_英字" TEXT,
  "効力発生日" TEXT,
  "廃止日" TEXT,
  "備考" TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS "city_code" ON "city" ("code");

CREATE TABLE IF NOT EXISTS "town" (
  "code" TEXT,
  "town_id" TEXT,
  "町字区分コード" TEXT,
  "都道府県名" TEXT,
  "都道府県名_カナ" TEXT,
  "都道府県名_英字" TEXT,
  "郡名" TEXT,
  "郡名_カナ" TEXT,
  "郡名_英字" TEXT,
  "市区町村名" TEXT,
  "市区町村名_カナ" TEXT,
  "市区町村名_英字" TEXT,
  "政令市区名" TEXT,
  "政令市区名_カナ" TEXT,
  "政令市区名_英字" TEXT,
  "大字・町名" TEXT,
  "大字・町名_カナ" TEXT,
  "大字・町名_英字" TEXT,
  "丁目名" TEXT,
  "丁目名_カナ" TEXT,
  "丁目名_数字" TEXT,
  "小字名" TEXT,
  "小字名_カナ" TEXT,
  "小字名_英字" TEXT,
  "住居表示フラグ" TEXT,
  "住居表示方式コード" TEXT,
  "大字・町名_通称フラグ" TEXT,
  "小字名_通称フラグ" TEXT,
  "大字・町名_電子国土基本図外字" TEXT,
  "小字名_電子国土基本図外字" TEXT,
  "状態フラグ" TEXT,
  "起番フラグ" TEXT,
  "効力発生日" TEXT,
  "廃止日" TEXT,
  "原典資料コード" TEXT,
  "郵便番号" TEXT,
  "備考" TEXT,

  -- mt_town_pos_prefXX から結合
  "代表点_経度" REAL DEFAULT null,
  "代表点_緯度" REAL DEFAULT null
);

CREATE UNIQUE INDEX IF NOT EXISTS "town_code" ON "town" ("code", "town_id");

CREATE TABLE IF NOT EXISTS "rsdtdsp_blk" (
  "code" TEXT,
  "town_id" TEXT,
  "blk_id" TEXT,
  "市区町村名" TEXT,
  "政令市区名" TEXT,
  "大字・町名" TEXT,
  "丁目名" TEXT,
  "小字名" TEXT,
  "街区符号" TEXT,
  "住居表示フラグ" TEXT,
  "住居表示方式コード" TEXT,
  "大字・町名_電子国土基本図外字" TEXT,
  "小字名_電子国土基本図外字" TEXT,
  "状態フラグ" TEXT,
  "効力発生日" TEXT,
  "廃止日" TEXT,
  "原典資料コード" TEXT,
  "備考" TEXT,

  -- mt_rsdtdsp_blk_pos_prefXX から結合
  "代表点_経度" REAL,
  "代表点_緯度" REAL
);

CREATE UNIQUE INDEX IF NOT EXISTS "rsdtdsp_blk_code" ON "rsdtdsp_blk" ("code", "town_id", "blk_id");

CREATE TABLE IF NOT EXISTS "rsdtdsp_rsdt" (
  "code" TEXT,
  "town_id" TEXT,
  "blk_id" TEXT,
  "addr_id" TEXT,
  "addr2_id" TEXT,
  "市区町村名" TEXT,
  "政令市区名" TEXT,
  "大字・町名" TEXT,
  "丁目名" TEXT,
  "小字名" TEXT,
  "街区符号" TEXT,
  "住居番号" TEXT,
  "住居番号2" TEXT,
  "基礎番号・住居番号区分" TEXT,
  "住居表示フラグ" TEXT,
  "住居表示方式コード" TEXT,
  "大字・町名_電子国土基本図外字" TEXT,
  "小字名_電子国土基本図外字" TEXT,
  "状態フラグ" TEXT,
  "効力発生日" TEXT,
  "廃止日" TEXT,
  "原典資料コード" TEXT,
  "備考" TEXT,

  -- mt_rsdtdsp_rsdt_pos_prefXX から結合
  "代表点_経度" REAL,
  "代表点_緯度" REAL
);

CREATE UNIQUE INDEX IF NOT EXISTS "rsdtdsp_rsdt_code" ON "rsdtdsp_rsdt" ("code", "town_id", "blk_id", "addr_id", "addr2_id");

CREATE TABLE IF NOT EXISTS "metadata" (
  "key" TEXT,
  "value" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "metadata_key" ON "metadata" ("key");
