import path from "node:path";

import * as NJANormalize from './engine/normalize'

import type BetterSqlite3 from "better-sqlite3";
import Database from "better-sqlite3";

/*
 * Roles of this module:
 * * load dataset sqlite file
 * * perform geocoding
 */

export type GeocodingResult = {
  input: string
  level: number
}

export type NormalizeOptions = NJANormalize.Option;

export class Normalize {
  dataDir: string
  sourceId: string

  _db: BetterSqlite3.Database

  constructor(dataDir: string, sourceId: string) {
    this.dataDir = dataDir;
    this.sourceId = sourceId;
    this._db = new Database(path.join(dataDir, `${sourceId}.sqlite`), {
      readonly: true,
    });

    const _prefectureStmt = this._db.prepare(`
      SELECT
        "都道府県名" AS "todofuken_name",
        json_group_array(json_object(
          'name', "郡名" || "市区町村名" || "政令市区名",
          'code', "code"
        )) AS "towns"
      FROM city
      GROUP BY "都道府県名"
    `);
    const _townsStmt = this._db.prepare(`
      select
        "town"."code",
        "town"."town_id",
        "大字・町名" || "丁目名" as "town",
        "小字名" as "koaza",
        "代表点_緯度" as "lat",
        "代表点_経度" as "lon"
      from
        "city"
        left join "town" on town.code = city.code
      where
        "city"."都道府県名" = ?
        AND "city"."郡名" || "city"."市区町村名" || "city"."政令市区名" = ?
        AND "町字区分コード" <> 3;
    `);
    const _blksStmt = this._db.prepare(`
      select
        "blk"."code",
        "blk"."town_id",
        "blk"."blk_id",
        city."都道府県名" as "pref",
        city."郡名" || city."市区町村名" || city."政令市区名" as "city",
        town."大字・町名" || town."丁目名" as "town",
        blk."街区符号" as "blk",
        blk."代表点_緯度" as "lat",
        blk."代表点_経度" as "lon"
      from
        "city"
        left join "town" on town.code = city.code and (town."大字・町名" || town."丁目名" = ?)
        left join "rsdtdsp_blk" "blk" on blk.code = city.code and blk.town_id = town.town_id
      where
        city."都道府県名" = ?
        AND "city"."郡名" || "city"."市区町村名" || "city"."政令市区名" = ?
        and blk."街区符号" is not null
    `);
    const _rsdtStmt = this._db.prepare(`
      select
        "rsdt"."code",
        "rsdt"."town_id",
        "rsdt"."blk_id",
        "rsdt"."addr_id" as "addr1_id",
        "rsdt"."addr2_id",
        blk."街区符号" as "blk",
        rsdt."住居番号" as "addr1",
        rsdt."住居番号2" as "addr2",
        rsdt."代表点_緯度" as "lat",
        rsdt."代表点_経度" as "lon"
      from "city"
      left join "town" on town.code = city.code and (town."大字・町名" || town."丁目名" = ?)
      left join "rsdtdsp_blk" "blk" on blk.code = city.code and blk.town_id = town.town_id
      left join "rsdtdsp_rsdt" "rsdt" on rsdt.code = city.code and rsdt.town_id = town.town_id and rsdt.blk_id = blk.blk_id
      where
        city."都道府県名" = ?
        AND "city"."郡名" || "city"."市区町村名" || "city"."政令市区名" = ?
        and blk."街区符号" is not null
        and (rsdt."住居番号" is not null or rsdt."住居番号2" is not null)
    `);

    NJANormalize.__internals.fetch = async (path: string) => {
      const decoded = decodeURIComponent(path).replace(/\.json$/, '');
      const requestPath = decoded.split('/');
      if (requestPath.length === 1) {
        // a request to `.json`
        // prefectures
        const prefs: {
          todofuken_name: string;
          towns: string;
        }[] = _prefectureStmt.all() as any;
        return { json: async () => {
          const out: { [key: string]: string[] } = {};
          for (const { todofuken_name, towns } of prefs) {
            out[todofuken_name] = JSON.parse(towns);
          }
          return out;
        }}
      } else if (requestPath.length === 3) {
        // a request to `/{pref}/{city}.json`
        const pref = requestPath[1],
              city = requestPath[2];
        const towns = _townsStmt.all(pref, city);
        return { json: async () => {
          return towns;
        }};
      } else if (requestPath.length === 4) {
        // a request to `/{pref}/{city}/{town}.json`
        const pref = requestPath[1],
              city = requestPath[2],
              town = requestPath[3];
        const blks = _blksStmt.all(town, pref, city);
        return { json: async () => {
          return blks;
        }};
      } else if (requestPath.length === 5 && requestPath[4] === '住居表示') {
        // a request to `/{pref}/{city}/{town}/住居表示.json`
        const pref = requestPath[1],
              city = requestPath[2],
              town = requestPath[3];
        const rsdts = _rsdtStmt.all(town, pref, city);
        return { json: async () => {
          return rsdts;
        }};
      } else {
        return { json: async () => {
          return {};
        } }
      }
    };
  }

  close() {
    this._db.close();
  }

  normalizeAddress(string: string, options?: NormalizeOptions): Promise<NJANormalize.NormalizeResult> {
    return NJANormalize.normalize(string, {
      level: 8,
      ...(options || {}),
    });
  }
}
