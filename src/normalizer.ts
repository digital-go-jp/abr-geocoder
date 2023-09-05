import path from 'node:path';
import * as NJANormalize from './engine/normalize';

import type BetterSqlite3 from 'better-sqlite3';
import Database from 'better-sqlite3';

/*
 * Roles of this module:
 * * load dataset sqlite file
 * * perform geocoding
 */

export type GeocodingResult = {
  input: string;
  level: number;
};

export type NormalizeOptions = NJANormalize.Option;

export type Prefecture = {
  todofuken_name: string;
  towns: string;
};

export class Normalize {
  private db: BetterSqlite3.Database;

  constructor(dataDir: string, sourceId: string) {
    this.db = new Database(path.join(dataDir, `${sourceId}.sqlite`), {
      readonly: true,
    });

    const prefectureStmt = this.db.prepare(`
      SELECT
        pref_name AS "todofuken_name",
        json_group_array(json_object(
          'name', country_name || city_name || od_city_name,
          'code', "code"
        )) AS "towns"
      FROM city
      GROUP BY pref_name
    `);
    const townsStmt = this.db.prepare(`
      select
        "town"."code",
        "town"."town_id",
        oaza_town_name || chome_name as "town",
        koaza_name as "koaza",
        rep_pnt_lat as "lat",
        rep_pnt_lon as "lon"
      from
        "city"
        left join "town" on town.code = city.code
      where
        "city".pref_name = ?
        AND "city".country_name || "city".city_name || "city".od_city_name = ?
        AND town_code <> 3;
    `);
    const blksStmt = this.db.prepare(`
      select
        "blk"."code",
        "blk"."town_id",
        "blk"."blk_id",
        city.pref_name as "pref",
        city.country_name || city.city_name || city.od_city_name as "city",
        town.oaza_town_name || town.chome_name as "town",
        blk.blk_num as "blk",
        blk.rep_pnt_lat as "lat",
        blk.rep_pnt_lon as "lon"
      from
        "city"
        left join "town" on town.code = city.code and (town.oaza_town_name || town.chome_name = ?)
        left join "rsdtdsp_blk" "blk" on blk.code = city.code and blk.town_id = town.town_id
      where
        city.pref_name = ?
        AND "city".country_name || "city".city_name || "city".od_city_name = ?
        and blk.blk_num is not null
    `);
    const rsdtStmt = this.db.prepare(`
      select
        "rsdt"."code",
        "rsdt"."town_id",
        "rsdt"."blk_id",
        "rsdt"."addr_id" as "addr1_id",
        "rsdt"."addr2_id",
        blk.blk_num as "blk",
        rsdt.rsdt_num as "addr1",
        rsdt.rsdt_num2 as "addr2",
        rsdt.rep_pnt_lat as "lat",
        rsdt.rep_pnt_lon as "lon"
      from "city"
      left join "town" on town.code = city.code and (town.oaza_town_name || town.chome_name = ?)
      left join "rsdtdsp_blk" "blk" on blk.code = city.code and blk.town_id = town.town_id
      left join "rsdtdsp_rsdt" "rsdt" on rsdt.code = city.code and rsdt.town_id = town.town_id and rsdt.blk_id = blk.blk_id
      where
        city.pref_name = ?
        AND "city".country_name || "city".city_name || "city".od_city_name = ?
        and blk.blk_num is not null
        and (rsdt.rsdt_num is not null or rsdt.rsdt_num2 is not null)
    `);

    NJANormalize.internals.fetch = async (path: string) => {
      const decoded = decodeURIComponent(path).replace(/\.json$/, '');
      const requestPath = decoded.split('/');
      if (requestPath.length === 1) {
        // a request to `.json`
        // prefectures
        const prefs: Prefecture[] = prefectureStmt.all() as Prefecture[];
        return {
          json: async () => {
            const out: { [key: string]: string[] } = {};
            for (const { todofuken_name, towns } of prefs) {
              out[todofuken_name] = JSON.parse(towns);
            }
            return out;
          },
        };
      } else if (requestPath.length === 3) {
        // a request to `/{pref}/{city}.json`
        const pref = requestPath[1],
          city = requestPath[2];
        const towns = townsStmt.all(pref, city);
        return {
          json: async () => {
            return towns;
          },
        };
      } else if (requestPath.length === 4) {
        // a request to `/{pref}/{city}/{town}.json`
        const pref = requestPath[1],
          city = requestPath[2],
          town = requestPath[3];
        const blks = blksStmt.all(town, pref, city);
        return {
          json: async () => {
            return blks;
          },
        };
      } else if (requestPath.length === 5 && requestPath[4] === '住居表示') {
        // a request to `/{pref}/{city}/{town}/住居表示.json`
        const pref = requestPath[1],
          city = requestPath[2],
          town = requestPath[3];
        const rsdts = rsdtStmt.all(town, pref, city);
        return {
          json: async () => {
            return rsdts;
          },
        };
      } else {
        return {
          json: async () => {
            return {};
          },
        };
      }
    };
  }

  close() {
    this.db.close();
  }

  normalizeAddress(
    string: string,
    options?: NormalizeOptions
  ): Promise<NJANormalize.NormalizeResult> {
    return NJANormalize.normalize(string, {
      level: 8,
      ...(options || {}),
    });
  }
}
