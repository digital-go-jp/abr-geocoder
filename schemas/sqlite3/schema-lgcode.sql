CREATE TABLE IF NOT EXISTS "rsdt_blk" (
  "rsdtblk_key" INTEGER PRIMARY KEY,
  "town_key" INTEGER,
  "blk_id" TEXT,
  "blk_num" TEXT,

  -- mt_rsdtdsp_blk_pos_prefXX から結合
  "rep_lat" REAL DEFAULT null,
  "rep_lon" REAL DEFAULT null
);
CREATE INDEX IF NOT EXISTS "idx_rsdt_blk_town_key" ON "rsdt_blk" (
  "town_key"
);
CREATE INDEX IF NOT EXISTS "idx_rsdt_blk_town_key_and_blk_num" ON "rsdt_blk" (
  "town_key", "blk_num"
);
CREATE TABLE IF NOT EXISTS "rsdt_dsp" (
  "rsdtdsp_key" INTEGER PRIMARY KEY,
  "rsdtblk_key" INTEGER,
  "rsdt_id" TEXT,
  "rsdt2_id" TEXT,
  "rsdt_num" TEXT,
  "rsdt_num2" TEXT,
  "rsdt_addr_flg" INTEGER,

  -- mt_rsdtdsp_rsdt_pos_prefXX から結合
  "rep_lat" REAL DEFAULT null,
  "rep_lon" REAL DEFAULT null
);

CREATE INDEX IF NOT EXISTS "idx_rsdt_dsp_rsdtblk_key" ON rsdt_dsp(
  "rsdtblk_key"
);

CREATE TABLE IF NOT EXISTS "parcel" (
  "parcel_key" INTEGER PRIMARY KEY,
  -- "city_key" INTEGER DEFAULT null,
  "town_key" INTEGER DEFAULT null,
  "prc_id" TEXT,
  "prc_num1" INTEGER,
  "prc_num2" INTEGER,
  "prc_num3" INTEGER,

  -- mt_parcel_pos_cityXXXXXX から結合
  "rep_lat" REAL DEFAULT null,
  "rep_lon" REAL DEFAULT null
);
-- CREATE INDEX IF NOT EXISTS idx_parcel_city_key ON parcel(city_key);
CREATE INDEX IF NOT EXISTS idx_parcel_town_key ON parcel(town_key, prc_id);