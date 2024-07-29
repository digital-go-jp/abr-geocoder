CREATE TABLE IF NOT EXISTS "pref" (
  "pref_key" INTEGER PRIMARY KEY,
  "lg_code" TEXT,
  "pref" TEXT,

  -- mt_pref_pos_all から結合
  "rep_lat" REAL DEFAULT null,
  "rep_lon" REAL DEFAULT null
);

CREATE TABLE IF NOT EXISTS "city" (
  "city_key" INTEGER PRIMARY KEY,
  "pref_key" INTEGER,
  "lg_code" TEXT UNIQUE,
  "county" TEXT,
  "city" TEXT,
  "ward" TEXT,

  -- mt_city_pos_all から結合
  "rep_lat" REAL DEFAULT null,
  "rep_lon" REAL DEFAULT null
);

CREATE INDEX IF NOT EXISTS idx_city_pref_key ON city(pref_key);
CREATE INDEX IF NOT EXISTS idx_city_ward ON city(ward);
CREATE INDEX IF NOT EXISTS idx_city_city ON city(city);
CREATE INDEX IF NOT EXISTS idx_city_county ON city(county);
CREATE INDEX IF NOT EXISTS idx_city_pref_key_and_city ON city(pref_key, city);
CREATE INDEX IF NOT EXISTS idx_city_city_and_ward ON city(city, ward);

CREATE TABLE IF NOT EXISTS "town" (
  "town_key" INTEGER PRIMARY KEY,
  "city_key" INTEGER,
  "machiaza_id" TEXT,
  "oaza_cho" TEXT,
  "chome" TEXT,
  "koaza" TEXT,
  "rsdt_addr_flg" INTEGER,

  -- mt_town_pos_prefXX から結合
  "rep_lat" REAL DEFAULT null,
  "rep_lon" REAL DEFAULT null
);

CREATE INDEX IF NOT EXISTS idx_town_city_key ON town(city_key);
CREATE INDEX IF NOT EXISTS idx_town_oaza_cho ON town(oaza_cho);
CREATE INDEX IF NOT EXISTS idx_town_chome ON town(chome);
CREATE INDEX IF NOT EXISTS idx_town_koaza ON town(koaza);