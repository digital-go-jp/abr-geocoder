/*!
 * MIT License
 *
 * Copyright (c) 2024 デジタル庁
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { AMBIGUOUS_RSDT_ADDR_FLG } from "@config/constant-values";
import { DataField } from "@config/data-field";
import { DbTableName } from "@config/db-table-name";
import crc32Lib from "@domain/services/crc32-lib";
import { TableKeyProvider } from "@domain/services/table-key-provider";
import { ChomeMachingInfo } from "@domain/types/geocode/chome-info";
import { CityInfo, CityMatchingInfo } from "@domain/types/geocode/city-info";
import { KoazaMachingInfo } from "@domain/types/geocode/koaza-info";
import { MatchLevel } from "@domain/types/geocode/match-level";
import { PrefInfo } from "@domain/types/geocode/pref-info";
import { TownMatchingInfo } from "@domain/types/geocode/town-info";
import { WardMatchingInfo } from "@domain/types/geocode/ward-info";
import { WardAndOazaMatchingInfo } from "@domain/types/geocode/ward-oaza-info";
import { PrefLgCode } from "@domain/types/pref-lg-code";
import { CharNode } from "@usecases/geocode/models/trie/char-node";
import { TrieAddressFinder } from "@usecases/geocode/models/trie/trie-finder";
import { ICommonDbGeocode } from "../../common-db";
import { Sqlite3Wrapper } from "../better-sqlite3-wrap";

type GetChomeRowsOptions = {
  pref_key: number;
  city_key: number;
  town_key: number;
  oaza_cho: string;
};

export class CommonDbGeocodeSqlite3 extends Sqlite3Wrapper implements ICommonDbGeocode {

  async close() {
    this.driver.close();
  }

  private getKyotoStreetSQL() {
    return `
      SELECT
        c.city_key,
        t.town_key,
        c.pref_key,
        p.${DataField.PREF.dbColumn} as pref,
        t.${DataField.CHOME.dbColumn} as chome,
        c.${DataField.CITY.dbColumn} as city,
        c.${DataField.COUNTY.dbColumn} as county,
        c.${DataField.WARD.dbColumn} as ward,
        c.${DataField.LG_CODE.dbColumn} AS lg_code,
        t.${DataField.OAZA_CHO.dbColumn} as oaza_cho,
        CAST(t.${DataField.RSDT_ADDR_FLG.dbColumn} AS INTEGER) as rsdt_addr_flg,
        CAST(t.${DataField.KOAZA_AKA_CODE.dbColumn} AS INTEGER) as koaza_aka_code,
        t.${DataField.KOAZA.dbColumn} as koaza,
        t.${DataField.MACHIAZA_ID.dbColumn} as machiaza_id,
        t.${DataField.REP_LAT.dbColumn} as rep_lat,
        t.${DataField.REP_LON.dbColumn} as rep_lon,
        IIF(
          substr(t.${DataField.MACHIAZA_ID.dbColumn}, 5, 7) = '000', 
          ${MatchLevel.MACHIAZA.num},
          ${MatchLevel.MACHIAZA_DETAIL.num}
        ) as match_level,
        IIF(
          substr(t.${DataField.MACHIAZA_ID.dbColumn}, 5, 7) = '000', 
          ${MatchLevel.MACHIAZA.num},
          ${MatchLevel.MACHIAZA_DETAIL.num}
        ) as coordinate_level
      FROM
        ${DbTableName.PREF} p
        JOIN ${DbTableName.CITY} c ON p.pref_key = c.pref_key
        JOIN ${DbTableName.TOWN} t ON c.city_key = t.city_key
      WHERE
        -- 京都市に関係するLG_Codeは"261"から始まる
        -- 京都府全体は"260xxx"なので、PrefLgCode.KYOTOは使えない
        substr(c.${DataField.LG_CODE.dbColumn}, 1, 3) = '261' AND
        t.${DataField.OAZA_CHO.dbColumn} IS NOT NULL
    `;
  };

  getKyotoStreetGeneratorHash() : string {
    // SQLに変更があった場合にキャッシュを再作成するために、SQL
    return crc32Lib.fromString(this.getKyotoStreetSQL());
  }

  getKyotoStreetRows(): Promise<KoazaMachingInfo[]> {
    type Row = Omit<KoazaMachingInfo, 'coordinate_level' | 'match_level'> & {
      match_level: number;
      coordinate_level: number;
    };
    const rows: Row[] = this.prepare<{}, Row>(this.getKyotoStreetSQL()).all({});

    const machiazaTable = new Map<string, Row>();
    const machiazaDetailTable = new Map<string, Row>();
    const insertIntoResultTable = (rows: Row[]) => {
      rows.forEach(row => {
        // データが不完全なものは排除
        if (!row.oaza_cho && !row.chome && !row.koaza || !row.rep_lat) {
          return;
        }

        if (row.match_level === MatchLevel.MACHIAZA.num) {
          machiazaTable.set(`${row.city_key}:${row.machiaza_id}`, row);
          return;
        }

        machiazaDetailTable.set(`${row.city_key}:${row.machiaza_id}`, row);
      });
    };
    insertIntoResultTable(rows);

    const results = Array.from(machiazaDetailTable.values()).map(row => {
      const match_level = row.match_level === MatchLevel.MACHIAZA.num ? MatchLevel.MACHIAZA : MatchLevel.MACHIAZA_DETAIL;
      let coordinate_level = row.coordinate_level === MatchLevel.MACHIAZA.num ? MatchLevel.MACHIAZA : MatchLevel.MACHIAZA_DETAIL;

      if (!row.rep_lat) {
        const machiaza = machiazaTable.get(`${row.city_key}:${row.machiaza_id.substring(0, 4)}000`);
        row.rep_lat = machiaza!.rep_lat;
        row.rep_lon = machiaza!.rep_lon;
        coordinate_level = MatchLevel.MACHIAZA;
      }

      return {
        ...row,
        match_level,
        coordinate_level,
      };
    });
    Array.from(machiazaTable.values()).forEach(row => {
      results.push({
        ...row,
        match_level: MatchLevel.MACHIAZA,
        coordinate_level: MatchLevel.MACHIAZA,
      });
    });

    return Promise.resolve(results);
  }

  private getChomeSQL(WHERE_CONDITION: string) {
    return `
        SELECT
          c.pref_key,
          c.city_key,
          t.town_key,
          t.${DataField.CHOME.dbColumn} as chome,
          p.${DataField.PREF.dbColumn} as pref,
          c.${DataField.CITY.dbColumn} as city,
          c.${DataField.COUNTY.dbColumn} as county,
          c.${DataField.WARD.dbColumn} as ward,
          c.${DataField.LG_CODE.dbColumn} AS lg_code,
          t.${DataField.OAZA_CHO.dbColumn} as oaza_cho,
          CAST(t.${DataField.RSDT_ADDR_FLG.dbColumn} as INTEGER) as rsdt_addr_flg,
          t.${DataField.KOAZA.dbColumn} as koaza,
          t.${DataField.MACHIAZA_ID.dbColumn} as machiaza_id,
          t.${DataField.REP_LAT.dbColumn} as rep_lat,
          t.${DataField.REP_LON.dbColumn} as rep_lon
  
        FROM
          ${DbTableName.PREF} p
          JOIN ${DbTableName.CITY} c ON p.pref_key = c.pref_key
          JOIN ${DbTableName.TOWN} t ON c.city_key = t.city_key
        WHERE
          t.${DataField.CHOME.dbColumn} != '' AND
          ${WHERE_CONDITION}
        GROUP BY
          c.pref_key, c.city_key, t.town_key, t.${DataField.CHOME.dbColumn}
      `;  
  }

  getChomeRowsGeneratorHash() : string {
    return crc32Lib.fromString(this.getChomeSQL(''));
  }

  getChomeRows(where: Partial<GetChomeRowsOptions>): Promise<ChomeMachingInfo[]> {
    const conditions: string[] = [];
    if (where.pref_key) {
      conditions.push(`c.pref_key = @pref_key`);
    }
    if (where.city_key) {
      conditions.push(`c.city_key = @city_key`);
    }
    if (where.town_key) {
      conditions.push(`t.town_key = @town_key`);
    }
    if (where.oaza_cho) {
      conditions.push(`t.${DataField.OAZA_CHO.dbColumn} = @oaza_cho`);
    }
    const WHERE_CONDITION = conditions.join(' AND ');
    const sql = this.getChomeSQL(WHERE_CONDITION);
    const results = this.prepare<Partial<GetChomeRowsOptions>, ChomeMachingInfo>(sql).all(where);

    return Promise.resolve(results);
  }

  async getPrefMap(): Promise<Map<number, PrefInfo>> {
    // if (this.resultCache.has('pref_map')) {
    //   return this.resultCache.get('pref_map') as Map<number, PrefInfo>;
    // }
    const prefRows = await this.getPrefList();
    const prefMap = new Map<number, PrefInfo>();
    prefRows.forEach(pref => {
      prefMap.set(pref.pref_key, pref);
    });
    // this.resultCache.set('pref_map', prefMap);
    return prefMap;
  }

  private getPrefSQL() {
    return `
        SELECT
          pref_key,
          ${DataField.LG_CODE.dbColumn} as lg_code,
          ${DataField.PREF.dbColumn} as pref,
          ${DataField.REP_LAT.dbColumn} as rep_lat,
          ${DataField.REP_LON.dbColumn} as rep_lon
        FROM
          ${DbTableName.PREF}
      `;
  }
  
  // ------------------------------------
  // prefテーブルを HashMapにして返す
  // ------------------------------------
  async getPrefList(): Promise<PrefInfo[]> {
    // if (this.resultCache.has('pref_list')) {
    //   return this.resultCache.get('pref_list') as PrefInfo[];
    // }
    return new Promise((resolve: (rows: PrefInfo[]) => void) => {
      const sql = this.getPrefSQL();
      const rows = this.prepare<unknown[], PrefInfo>(sql).all();
  
      // this.resultCache.set('pref_list', rows);
      resolve(rows);
    });
  }
  getPrefListGeneratorHash() : string {
    return crc32Lib.fromString(this.getPrefSQL());
  }

  private getCitySQL() {
    return `
      SELECT
        city_key,
        pref_key,
        ${DataField.LG_CODE.dbColumn} as lg_code,
        ${DataField.COUNTY.dbColumn} as county,
        ${DataField.CITY.dbColumn} as city,
        ${DataField.WARD.dbColumn} as ward,
        ${DataField.REP_LAT.dbColumn} as rep_lat,
        ${DataField.REP_LON.dbColumn} as rep_lon
      FROM
        ${DbTableName.CITY}
    `;
  }
  getCityListGeneratorHash() : string {
    return crc32Lib.fromString(this.getCitySQL());
  }

  async getCityList(): Promise<CityInfo[]> {
    type CityRow = Omit<CityInfo, 'pref'>;

    const [
      prefMap,
      cityRows,
    ] = await Promise.all([
      this.getPrefMap(),
      new Promise((resolve: (rows:  Omit<CityInfo, 'pref'>[]) => void) => {
        const sql = this.getCitySQL();
        const townRows = this.prepare<unknown[],  CityRow>(sql).all();
        resolve(townRows);
      }),
    ]);

    const results = cityRows.map(city => {
      return {
        ...city,
        pref: prefMap.get(city.pref_key)!.pref,
      };
    });

    // this.resultCache.set('city_list', results);
    return results;
  }
  
  private async getCityMap(): Promise<Map<number, CityInfo>> {
    // if (this.resultCache.has('city_map')) {
    //   return this.resultCache.get('city_map') as Map<number, CityInfo>;
    // }

    const [
      prefMap,
      cityRows,
    ] = await Promise.all([
      this.getPrefMap(),
      this.getCityList(),
    ]);

    const cityMap = new Map<number, CityInfo>();
    cityRows.forEach(city => {
      cityMap.set(city.city_key, {
        ...city,
        pref: prefMap.get(city.pref_key)!.pref,
      });
    });

    // this.resultCache.set('city_map', cityMap);
    return cityMap;
  }
  
  getOazaChomesGeneratorHash() : string {
    return crc32Lib.fromString([
      this.getOazaChomesSQL1(),
      this.getOazaChomesSQL2(),
      this.getOazaChomesSQL3(),
      this.getOazaChomesSQL4(),
      this.getOazaChomesSQL5(),
      this.getOazaChomesSQL6(),
    ].join(''));
  }

  private getOazaChomesSQL1() {
    return `
      SELECT
        (
          t.city_key ||
          substr(t.${DataField.MACHIAZA_ID.dbColumn}, 1, 4) ||
          '000*'
        ) as pkey,
        NULL as town_key,
        t.city_key,
        (substr(t.${DataField.MACHIAZA_ID.dbColumn}, 1, 4) || '000') as machiaza_id,
        t.${DataField.KOAZA_AKA_CODE.dbColumn} as koaza_aka_code,
        t.${DataField.OAZA_CHO.dbColumn} as oaza_cho,
        '' as chome,
        '' as koaza,
        ${AMBIGUOUS_RSDT_ADDR_FLG} as rsdt_addr_flg,  /* 0 と 1が混ざる可能性があるので、AMBIGUOUS_RSDT_ADDR_FLG */
        c.${DataField.REP_LAT.dbColumn} as rep_lat,
        c.${DataField.REP_LON.dbColumn} as rep_lon,
        ${MatchLevel.MACHIAZA.num} as match_level,
        ${MatchLevel.CITY.num} as coordinate_level
      FROM
        ${DbTableName.TOWN} as t
        JOIN ${DbTableName.CITY} as c ON t.city_key = c.city_key
        JOIN ${DbTableName.PREF} as p ON p.pref_key = c.pref_key
      WHERE
        (
          t.${DataField.OAZA_CHO.dbColumn} != '' AND
          t.${DataField.OAZA_CHO.dbColumn} IS NOT NULL
        ) AND 
        substr(t.${DataField.MACHIAZA_ID.dbColumn}, 5, 7) != '000' AND
        t.${DataField.KOAZA_AKA_CODE.dbColumn} != '2' AND
        p.${DataField.LG_CODE.dbColumn} = @lg_code
      GROUP BY
        pkey
    `;
  }
  
  private getOazaChomesSQL2() {
    return `
        SELECT
          (
            t.city_key ||
            t.${DataField.MACHIAZA_ID.dbColumn} ||
            t.${DataField.RSDT_ADDR_FLG.dbColumn}
          ) as pkey,
          t.town_key,
          t.city_key,
          t.${DataField.MACHIAZA_ID.dbColumn} as machiaza_id,
          t.${DataField.OAZA_CHO.dbColumn} as oaza_cho,
          t.${DataField.CHOME.dbColumn} as chome,
          '' as koaza,
          t.${DataField.KOAZA_AKA_CODE.dbColumn} as koaza_aka_code,
          CAST(t.${DataField.RSDT_ADDR_FLG.dbColumn} as INTEGER) as rsdt_addr_flg,
          IFNULL(
            t.${DataField.REP_LAT.dbColumn},
            c.${DataField.REP_LAT.dbColumn}
          ) as rep_lat,
          IFNULL(
            t.${DataField.REP_LON.dbColumn},
            c.${DataField.REP_LON.dbColumn}
          ) as rep_lon,
          ${MatchLevel.MACHIAZA_DETAIL.num} as match_level,
          IIF(
            t.${DataField.REP_LAT.dbColumn} = '' OR t.${DataField.REP_LAT.dbColumn} IS NULL,
            ${MatchLevel.CITY.num},
            ${MatchLevel.MACHIAZA_DETAIL.num}
          ) as coordinate_level
        FROM
          ${DbTableName.TOWN} as t
          JOIN ${DbTableName.CITY} as c ON t.city_key = c.city_key
          JOIN ${DbTableName.PREF} as p ON p.pref_key = c.pref_key
        WHERE
          (
            t.${DataField.OAZA_CHO.dbColumn} != '' AND
            t.${DataField.OAZA_CHO.dbColumn} IS NOT NULL
          ) AND 
          substr(t.${DataField.MACHIAZA_ID.dbColumn}, 5, 7) != '000' AND
          t.${DataField.KOAZA_AKA_CODE.dbColumn} != '2' AND
          p.${DataField.LG_CODE.dbColumn} = @lg_code
      `;
  }
  
  
  private getOazaChomesSQL3() {
    return `
        SELECT
          (
            t.city_key ||
            t.${DataField.MACHIAZA_ID.dbColumn} ||
            t.${DataField.RSDT_ADDR_FLG.dbColumn}
          ) as pkey,
          t.town_key,
          t.city_key,
          t.${DataField.MACHIAZA_ID.dbColumn} as machiaza_id,
          '' as oaza_cho,
          '' as chome,
          t.${DataField.KOAZA.dbColumn} as koaza,
          t.${DataField.KOAZA_AKA_CODE.dbColumn} as koaza_aka_code,
          CAST(t.${DataField.RSDT_ADDR_FLG.dbColumn} AS INTEGER) as rsdt_addr_flg,
          IFNULL(
            t.${DataField.REP_LAT.dbColumn},
            c.${DataField.REP_LAT.dbColumn}
          ) as rep_lat,
          IFNULL(
            t.${DataField.REP_LON.dbColumn},
            c.${DataField.REP_LON.dbColumn}
          ) as rep_lon,
          ${MatchLevel.MACHIAZA_DETAIL.num} as match_level,
          IIF(
            t.${DataField.REP_LAT.dbColumn} = '' OR t.${DataField.REP_LAT.dbColumn} IS NULL,
            ${MatchLevel.CITY.num},
            ${MatchLevel.MACHIAZA_DETAIL.num}
          ) as coordinate_level
        FROM
          ${DbTableName.TOWN} as t
          JOIN ${DbTableName.CITY} as c ON t.city_key = c.city_key
          JOIN ${DbTableName.PREF} as p ON p.pref_key = c.pref_key
        WHERE
          (
            t.${DataField.OAZA_CHO.dbColumn} = '' OR
            t.${DataField.OAZA_CHO.dbColumn} IS NULL
          ) AND 
          substr(t.${DataField.MACHIAZA_ID.dbColumn}, 5, 7) != '000' AND
          t.${DataField.KOAZA_AKA_CODE.dbColumn} != '2' AND
          p.${DataField.LG_CODE.dbColumn} = @lg_code
      `;
  }
  
  private getOazaChomesSQL4() {
    return `
        SELECT
          (
            t.city_key ||
            t.${DataField.MACHIAZA_ID.dbColumn} ||
            t.${DataField.RSDT_ADDR_FLG.dbColumn}
          ) as pkey,
          t.town_key,
          t.city_key,
          t.${DataField.MACHIAZA_ID.dbColumn} as machiaza_id,
          '' as oaza_cho,
          t.${DataField.CHOME.dbColumn} as chome,
          t.${DataField.KOAZA.dbColumn} as koaza,
          t.${DataField.KOAZA_AKA_CODE.dbColumn} as koaza_aka_code,
          CAST(t.${DataField.RSDT_ADDR_FLG.dbColumn} AS INTEGER) as rsdt_addr_flg,
          IFNULL(
            t.${DataField.REP_LAT.dbColumn},
            c.${DataField.REP_LAT.dbColumn}
          ) as rep_lat,
          IFNULL(
            t.${DataField.REP_LON.dbColumn},
            c.${DataField.REP_LON.dbColumn}
          ) as rep_lon,
          ${MatchLevel.MACHIAZA_DETAIL.num} as match_level,
          IIF(
            t.${DataField.REP_LAT.dbColumn} = '' OR t.${DataField.REP_LAT.dbColumn} IS NULL,
            ${MatchLevel.CITY.num},
            ${MatchLevel.MACHIAZA_DETAIL.num}
          ) as coordinate_level
        FROM
          ${DbTableName.TOWN} as t
          JOIN ${DbTableName.CITY} as c ON t.city_key = c.city_key
          JOIN ${DbTableName.PREF} as p ON p.pref_key = c.pref_key
        WHERE
          (
            t.${DataField.OAZA_CHO.dbColumn} = '' OR
            t.${DataField.OAZA_CHO.dbColumn} IS NULL
          ) AND (
            t.${DataField.CHOME.dbColumn} != '' AND
            t.${DataField.CHOME.dbColumn} IS NOT NULL
          ) AND 
          t.${DataField.KOAZA_AKA_CODE.dbColumn} != '2' AND
          p.${DataField.LG_CODE.dbColumn} = @lg_code
      `;
  }
  
  private getOazaChomesSQL5() {
    return `
        SELECT
          (
            t.city_key ||
            t.${DataField.MACHIAZA_ID.dbColumn} ||
            t.${DataField.RSDT_ADDR_FLG.dbColumn}
          ) as pkey,
          t.town_key,
          t.city_key,
          t.${DataField.MACHIAZA_ID.dbColumn} as machiaza_id,
          t.${DataField.OAZA_CHO.dbColumn} as oaza_cho,
          t.${DataField.CHOME.dbColumn} as chome,
          t.${DataField.KOAZA.dbColumn} as koaza,
          t.${DataField.KOAZA_AKA_CODE.dbColumn} as koaza_aka_code,
          CAST(t.${DataField.RSDT_ADDR_FLG.dbColumn} AS INTEGER) as rsdt_addr_flg,
          IFNULL(
            t.${DataField.REP_LAT.dbColumn},
            c.${DataField.REP_LAT.dbColumn}
          ) as rep_lat,
          IFNULL(
            t.${DataField.REP_LON.dbColumn},
            c.${DataField.REP_LON.dbColumn}
          ) as rep_lon,
          ${MatchLevel.MACHIAZA_DETAIL.num} as match_level,
          IIF(
            t.${DataField.REP_LAT.dbColumn} = '' OR t.${DataField.REP_LAT.dbColumn} IS NULL,
            ${MatchLevel.CITY.num},
            ${MatchLevel.MACHIAZA_DETAIL.num}
          ) as coordinate_level
        FROM
          ${DbTableName.TOWN} as t
          JOIN ${DbTableName.CITY} as c ON t.city_key = c.city_key
          JOIN ${DbTableName.PREF} as p ON p.pref_key = c.pref_key
        WHERE
          (
            t.${DataField.OAZA_CHO.dbColumn} != '' AND
            t.${DataField.OAZA_CHO.dbColumn} IS NOT NULL
          ) AND
          substr(t.${DataField.MACHIAZA_ID.dbColumn}, 5, 7) != '000' AND
          t.${DataField.KOAZA_AKA_CODE.dbColumn} != '2' AND
          p.${DataField.LG_CODE.dbColumn} = @lg_code
      `;
  }
  
  private getOazaChomesSQL6() {
    return `
        SELECT
            (
              t.city_key ||
              t.${DataField.MACHIAZA_ID.dbColumn} ||
              t.${DataField.RSDT_ADDR_FLG.dbColumn}
          ) as pkey,
          t.town_key,
          t.city_key,
          t.${DataField.MACHIAZA_ID.dbColumn} as machiaza_id,
          t.${DataField.OAZA_CHO.dbColumn} as oaza_cho,
          t.${DataField.CHOME.dbColumn} as chome,
          t.${DataField.KOAZA_AKA_CODE.dbColumn} as koaza_aka_code,
          '' as koaza,
          CAST(t.${DataField.RSDT_ADDR_FLG.dbColumn} AS INTEGER) as rsdt_addr_flg,
          IFNULL(
            t.${DataField.REP_LAT.dbColumn},
            c.${DataField.REP_LAT.dbColumn}
          ) as rep_lat,
          IFNULL(
            t.${DataField.REP_LON.dbColumn},
            c.${DataField.REP_LON.dbColumn}
          ) as rep_lon,
          ${MatchLevel.MACHIAZA.num} as match_level,
          IIF(
            t.${DataField.REP_LAT.dbColumn} = '' OR t.${DataField.REP_LAT.dbColumn} IS NULL,
            ${MatchLevel.CITY.num},
            ${MatchLevel.MACHIAZA.num}
          ) as coordinate_level
        FROM
          ${DbTableName.TOWN} as t
          JOIN ${DbTableName.CITY} as c ON t.city_key = c.city_key
          JOIN ${DbTableName.PREF} as p ON p.pref_key = c.pref_key
        WHERE
          (
            t.${DataField.OAZA_CHO.dbColumn} != '' AND
            t.${DataField.OAZA_CHO.dbColumn} IS NOT NULL
          ) AND
          substr(t.${DataField.MACHIAZA_ID.dbColumn}, 5, 7) = '000' AND
          t.${DataField.KOAZA_AKA_CODE.dbColumn} != '2' AND
          p.${DataField.LG_CODE.dbColumn} = @lg_code
      `;
  }

  async getOazaChomes(params: {
    lg_code: string;
  }): Promise<TownMatchingInfo[]> {

    type Row = {
      pkey: string;
      town_key: number;
      city_key: number;
      machiaza_id: string;
      oaza_cho: string;
      chome: string;
      koaza: string;
      rsdt_addr_flg: number;
      rep_lat: string;
      rep_lon: string;
      match_level: number;
      coordinate_level: number;
      koaza_aka_code: number;
    };

    const [
      prefMap,
      cityMap,
    ] = await Promise.all([
      this.getPrefMap(),
      this.getCityMap(),
    ]);

    const workTable = new Map<string, Row>();
    const insertIntoResultTable = (rows: Row[]) => {
      rows.forEach(row => {
        // データが不完全なものは排除
        if (!row.oaza_cho && !row.chome && !row.koaza || !row.rep_lat) {
          return;
        }
        switch (row.pkey.at(-1)) {
          case '*': {
            // 0か1なのか、selectした時点では分からない: 
            workTable.set(row.pkey, row);
            return;
          }
          case '0':
          case '1': {
            // '*' を末尾に持つkeyがあれば、0と1に分解する
            const otherKey = row.pkey.substring(0, row.pkey.length - 1) + '*';
            if (workTable.has(otherKey)) {
              const prev = workTable.get(otherKey)!;
              workTable.delete(otherKey);
              const pkey0 = row.pkey.substring(0, row.pkey.length - 1) + '0';
              const pkey1 = row.pkey.substring(0, row.pkey.length - 1) + '1';
              if (prev.coordinate_level > row.coordinate_level) {
                row.coordinate_level = prev.coordinate_level;
                row.rep_lat = prev.rep_lat;
                row.rep_lon = prev.rep_lon;
              }
              [pkey0, pkey1].forEach(pkey => {
                workTable.set(pkey, row);
              });
            }

            // 本来の値でセットする
            workTable.set(row.pkey, row);
            return;
          }

          default:
            // Do nothing here
        }
      });
    };

    {
      /*
        * パターン： 〇〇(大字)〇〇丁目
        *
        * 〇〇丁目の場合、全体を包括する緯度経度やmachiaza_id がないので
        * machiaza_idの上4桁だけを採用し、rep_lat, rep_lonは NULL にする
        *
        * 霞が関一丁目 -> 35.673944,139.752558
        * 霞が関二丁目 -> 35.675551,139.750413
        * 霞が関三丁目 -> 35.671825,139.746988
        * ↓
        * 霞が関 -> NULL, NULL
        */
      const sql = this.getOazaChomesSQL1();
      const rows = this.driver.prepare<{lg_code: string;}, Row>(sql).all(params);
      insertIntoResultTable(rows);
    }

    {
      /*
        * パターン： 〇〇(大字)〇〇丁目
        *
        * 〇〇丁目の場合、丁目までヒットするので
        * ヒットできるならヒットさせる
        *
        * 霞が関一丁目 -> 35.673944,139.752558
        * 霞が関二丁目 -> 35.675551,139.750413
        * 霞が関三丁目 -> 35.671825,139.746988
        */
      const sql = this.getOazaChomesSQL2();
      const rows = this.driver.prepare<{lg_code: string;}, Row>(sql).all(params);
      insertIntoResultTable(rows);
    }

    {

      /*
       * パターン： 〇〇小字 (大字が省略、小字)
       *
       * 青森県八戸市新井田（大字）市子林（字）の「新井田」が省略されているデータも存在する
       * 大字をデータから特定することはできない
       *
       * 番尻 -> 40.399914,141.508122
       * 長沢団地 -> 40.503892,141.564006
       * 寺地 -> 40.462681,141.541286
       */
      const sql = this.getOazaChomesSQL3();

      const rows = this.driver.prepare<{lg_code: string;}, Row>(sql).all(params);
      insertIntoResultTable(rows);
    }

    {

      /*
       * パターン： 〇〇市〇〇丁目 (大字が省略、丁目のみ)
       *
       * 宮城県大崎市三丁目のように、大字がなくて丁目が来るパターンがある
       */
      const sql = this.getOazaChomesSQL4();
      const rows = this.driver.prepare<{lg_code: string;}, Row>(sql).all(params);
      insertIntoResultTable(rows);
    }

    {

      /*
       * パターン： 〇〇(大字)〇〇(小字)
       */
      const sql = this.getOazaChomesSQL5();

      const rows = this.driver.prepare<{lg_code: string;}, Row>(sql).all(params);
      insertIntoResultTable(rows);
    }

    type OazaRow = {
      oaza_key: string;
      rep_lat: string;
      rep_lon: string;
      coordinate_level: number;
    };
    const oazaTree = new TrieAddressFinder<OazaRow>();
    {

      /*
        * パターン： 〇〇(大字)
        *
        * 大字だけで town にレコードがある場合、上書きする
        * (パターン2に該当するレコードがあるなら上書きする)
        *
        * 白川町 -> 35.235807	137.20991 （これがターゲット）
        * 白川町神田 -> NULL, NULL
        * 白川町堂丿前 -> NULL, NULL
        * ...
        *
        */
      const sql = this.getOazaChomesSQL6();

      const rows = this.driver.prepare<{lg_code: string;}, Row>(sql).all(params);
      insertIntoResultTable(rows);

      rows.forEach(row => {
        const oaza_key = [
          row.city_key.toString(),
          row.machiaza_id.substring(0, 4),
        ].join('');
        oazaTree.append({
          key: oaza_key,
          value: {
            oaza_key,
            rep_lat: row.rep_lat,
            rep_lon: row.rep_lon,
            coordinate_level: row.coordinate_level,
          },
        });
      });
    }

    //--------------------------------------
    // 大字・丁目で丁目が緯度経度を持っていないが
    // 大字が持っている場合がある。
    // この場合、大字の緯度経度を丁目に適用する
    //--------------------------------------
    const results: TownMatchingInfo[] = [];
    const seen = new Set<string>();

    workTable.forEach((row: Row) => {
      const key = `${row.city_key}:${row.machiaza_id}:${row.rsdt_addr_flg}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      // 情報を補正する
      const cityInfo = cityMap.get(row.city_key)!;
      const prefInfo = prefMap.get(cityInfo.pref_key)!;

      if (row.coordinate_level === MatchLevel.CITY.num) {
        // 大字だけで探索して、緯度経度の更新を試みる
        const oaza_key = `${row.city_key}${row.machiaza_id.substring(0, 4)}`;
        const matched = oazaTree.find({
          target: CharNode.create(oaza_key)!,
          fuzzy: undefined,
        });
        if (matched && matched.length > 0) {
          // coordinate_level が一番高い値を採用
          matched.sort((a, b) => b.info!.coordinate_level - a.info!.coordinate_level);
  
          row.coordinate_level = matched[0].info!.coordinate_level;
          if (matched[0].info!.rep_lat && matched[0].info!.rep_lon) {
            row.rep_lat = matched[0].info!.rep_lat;
            row.rep_lon = matched[0].info!.rep_lon;
            row.coordinate_level = matched[0].info!.coordinate_level;
          }
        }
      }
      // if (cityInfo.lg_code !== '011045' || row.machiaza_id.substring(0, 4) !== '0207') {
      //   return;
      // }

      // pkey 以外の値を戻す
      const value = {
        rep_lat: row.rep_lat,
        rep_lon: row.rep_lon,
        koaza: row.koaza,
        chome: row.chome,
        oaza_cho: row.oaza_cho,
        machiaza_id: row.machiaza_id,
        town_key: row.town_key,
        rsdt_addr_flg: row.rsdt_addr_flg,
        lg_code: cityInfo.lg_code,
        ward: cityInfo.ward,
        county: cityInfo.county,
        city_key: cityInfo.city_key,
        pref_key: cityInfo.pref_key,
        match_level: MatchLevel.from(row.match_level),
        coordinate_level: MatchLevel.from(row.coordinate_level),
        pref: prefInfo.pref,
        city: cityInfo.city,
        koaza_aka_code: row.koaza_aka_code,
      };

      results.push(value);

    });

    return results;
  }

  private getTokyo23TownSQL() {
    return `
        SELECT
          c.pref_key,
          c.city_key,
          t.town_key,
          t.${DataField.MACHIAZA_ID.dbColumn} as machiaza_id,
          p.${DataField.PREF.dbColumn} as pref,
          c.${DataField.LG_CODE.dbColumn} as lg_code,
          c.${DataField.COUNTY.dbColumn} as county,
          c.${DataField.CITY.dbColumn} as city,
          c.${DataField.WARD.dbColumn} as ward,
          (
            c.${DataField.CITY.dbColumn} || 
            t.${DataField.OAZA_CHO.dbColumn} ||
            t.${DataField.CHOME.dbColumn} ||
            t.${DataField.KOAZA.dbColumn}
          ) AS key,
          
          t.${DataField.OAZA_CHO.dbColumn} as oaza_cho,
          t.${DataField.CHOME.dbColumn} as chome,
          t.${DataField.KOAZA.dbColumn} as koaza,
          CAST(t.${DataField.RSDT_ADDR_FLG.dbColumn} AS INTEGER) as rsdt_addr_flg,
          t.${DataField.REP_LAT.dbColumn} as rep_lat,
          t.${DataField.REP_LON.dbColumn} as rep_lon
        from 
          ${DbTableName.PREF} p
          JOIN ${DbTableName.CITY} c ON p.pref_key = c.pref_key
          JOIN ${DbTableName.TOWN} t ON c.city_key = t.city_key
        where
          c.${DataField.CITY.dbColumn} like '%区' AND
          t.${DataField.KOAZA_AKA_CODE.dbColumn} != '2' AND
          c.pref_key = @tokyo_pref_key
      `;
  }
  
  getTokyo23TownsGeneratorHash() : string {
    return crc32Lib.fromString(this.getTokyo23TownSQL());
  }

  // -------------------------------------------------------------------------
  //  〇〇市〇〇大字〇〇丁目 と 〇〇市〇〇丁目〇〇小字 を作成する
  //
  //  補足:
  //  他の都道府県では「〇〇市北区」となるが、東京都23区の場合は「東京都北区〇〇市」となる。
  //
  //  北区〇〇と、都道府県を省略された場合、東京都が間違えてヒットするので、
  //  大字や丁目を含めてマッチングテストするために、パターンを作成する
  // -------------------------------------------------------------------------
  async getTokyo23Towns(): Promise<TownMatchingInfo[]> {
    
    return new Promise((resolve: (rows: TownMatchingInfo[]) => void) => {
      
      const params = {
        tokyo_pref_key: TableKeyProvider.getPrefKey({
          lg_code: PrefLgCode.TOKYO,
        }),
      };

      const sql = this.getTokyo23TownSQL();
      const results = this.prepare<{}, TownMatchingInfo>(sql).all(params);
      resolve(results);
    });
  };

  getCountyAndCityListGeneratorHash() : string {
    return this.getCityListGeneratorHash();
  }
  
  // -----------------------------------------
  // 〇〇区〇〇市、〇〇郡〇〇市町村 のHashMapを返す
  // -----------------------------------------
  async getCountyAndCityList(): Promise<CityMatchingInfo[]> {
    
    const cityMap = await this.getCityMap();
    return new Promise((resolve: (rows: CityMatchingInfo[]) => void) => {
      const results: CityMatchingInfo[] = [];
      for (const city_key of cityMap.keys()) {
        const city = cityMap.get(city_key)!;
        if (city.county === '' || !city.county) {
          continue;
        }
        results.push({
          key: [(city.county || ''), (city.city || '')].join(''),
          ...city,
        });
      }
      resolve(results);
    });
  }

  private getWardAndOazaChoSQL1() {
    return `
        CREATE TEMP TABLE WardAndOazaChoTmpTable (
          pkey TEXT PRIMARY KEY,
          pref_key INTEGER,
          city_key INTEGER,
          town_key INTEGER,
          pref TEXT,
          county TEXT,
          city TEXT,
          ward TEXT,
          lg_code TEXT,
          oaza_cho TEXT,
          machiaza_id TEXT,
          rsdt_addr_flg INTEGER,
          rep_lat TEXT,
          rep_lon TEXT,
          coordinate_level INTEGER
        );
      `;
  }
  private getWardAndOazaChoSQL2() {
    return `
        INSERT INTO WardAndOazaChoTmpTable
        SELECT
          (
            c.city_key ||
            (substr(t.${DataField.MACHIAZA_ID.dbColumn}, 1, 4) || '000')
          ) as pkey,
          p.pref_key,
          c.city_key,
          NULL AS town_key,
          p.${DataField.PREF.dbColumn} as pref,
          c.${DataField.COUNTY.dbColumn} as county,
          c.${DataField.CITY.dbColumn} as city,
          c.${DataField.WARD.dbColumn} as ward,
          c.${DataField.LG_CODE.dbColumn} as lg_code,
          t.${DataField.OAZA_CHO.dbColumn} as oaza_cho,
          (substr(t.${DataField.MACHIAZA_ID.dbColumn}, 1, 4) || '000') AS machiaza_id,
          -1 as rsdt_addr_flg,
          c.${DataField.REP_LAT.dbColumn} as rep_lat,
          c.${DataField.REP_LON.dbColumn} as rep_lon,
          ${MatchLevel.CITY.num} as coordinate_level
        FROM
          ${DbTableName.PREF} as p
          JOIN ${DbTableName.CITY} as c ON p.pref_key = c.pref_key
          JOIN ${DbTableName.TOWN} as t ON c.city_key = t.city_key
        WHERE
          c.${DataField.CITY.dbColumn} != '' AND
          c.${DataField.WARD.dbColumn} != '' AND
          t.${DataField.OAZA_CHO.dbColumn} != '' AND
          t.${DataField.OAZA_CHO.dbColumn} IS NOT NULL AND
          (
            (
              t.${DataField.CHOME.dbColumn} != '' AND
              t.${DataField.CHOME.dbColumn} IS NOT NULL
            ) OR (
              t.${DataField.KOAZA.dbColumn} != '' AND
              t.${DataField.KOAZA.dbColumn} IS NOT NULL
            )
          )
        GROUP BY
          pkey
      `;
  }
  private getWardAndOazaChoSQL3() {
    return `
      REPLACE INTO WardAndOazaChoTmpTable
      SELECT
        (
          c.city_key ||
          t.${DataField.MACHIAZA_ID.dbColumn}
        ) as pkey,
        p.pref_key,
        c.city_key,
        t.town_key,
        p.${DataField.PREF.dbColumn} as pref,
        c.${DataField.COUNTY.dbColumn} as county,
        c.${DataField.CITY.dbColumn} as city,
        c.${DataField.WARD.dbColumn} as ward,
        c.${DataField.LG_CODE.dbColumn} as lg_code,
        t.${DataField.OAZA_CHO.dbColumn} as oaza_cho,
        t.${DataField.MACHIAZA_ID.dbColumn} AS machiaza_id,
        CAST(t.${DataField.RSDT_ADDR_FLG.dbColumn} AS INTEGER) as rsdt_addr_flg,

        IIF(
          t.${DataField.REP_LAT.dbColumn} = '' OR t.${DataField.REP_LAT.dbColumn} IS NULL,
          c.${DataField.REP_LAT.dbColumn},
          t.${DataField.REP_LAT.dbColumn}
        ) as rep_lat,

        IIF(
          t.${DataField.REP_LAT.dbColumn} = '' OR t.${DataField.REP_LAT.dbColumn} IS NULL,
          c.${DataField.REP_LON.dbColumn},
          t.${DataField.REP_LON.dbColumn}
        ) as rep_lon,

        IIF(
          t.${DataField.REP_LAT.dbColumn} = '' OR t.${DataField.REP_LAT.dbColumn} IS NULL,
          ${MatchLevel.CITY.num},
          ${MatchLevel.MACHIAZA.num}
        ) as coordinate_level
      FROM
        ${DbTableName.PREF} as p
        JOIN ${DbTableName.CITY} as c ON p.pref_key = c.pref_key
        JOIN ${DbTableName.TOWN} as t ON c.city_key = t.city_key
      WHERE
        c.${DataField.CITY.dbColumn} != '' AND
        c.${DataField.WARD.dbColumn} != '' AND
        substr(t.${DataField.MACHIAZA_ID.dbColumn}, 5, 7) = '000'
    `;
  }
  

  getWardAndOazaChoListGeneratorHash() : string {
    return crc32Lib.fromString([
      this.getWardAndOazaChoSQL1(),
      this.getWardAndOazaChoSQL2(),
      this.getWardAndOazaChoSQL3(),
    ].join(''));
  }

  // -----------------------------------------
  // 〇〇区△△ のHashMapを返す（△△は大字）
  // -----------------------------------------
  getWardAndOazaChoList(): Promise<WardAndOazaMatchingInfo[]> {
    type WardAndOazaRow = {
      key: string;
      match_level: number;
      coordinate_level: number;
      town_key: number | null;
      city_key: number;
      pref_key: number;
      machiaza_id: string;
      oaza_cho: string;
      county: string;
      ward: string;
      pref: string;
      city: string;
      lg_code: string;
      rsdt_addr_flg: number;
      rep_lat: string;
      rep_lon: string;
    };

    return new Promise((resolve: (rows: WardAndOazaRow[]) => void) => {

      this.driver.exec(this.getWardAndOazaChoSQL1());

      this.driver.exec(this.getWardAndOazaChoSQL2());
      
      this.driver.exec(this.getWardAndOazaChoSQL3());
      const rows = this.prepare<unknown[], WardAndOazaRow>(`
        SELECT * FROM WardAndOazaChoTmpTable
      `).all();
      
      this.driver.exec('DROP TABLE WardAndOazaChoTmpTable');
      
      resolve(rows);
    })
      .then((rows: WardAndOazaRow[]) => {
        const results: WardAndOazaMatchingInfo[] = [];
        rows.forEach(row => {
          if (row.city_key !== 3587982500 || !row.oaza_cho.includes("御陵大枝山")) {
            return;
          }
          const key = row.ward + row.oaza_cho;
          const coordinate_level = row.coordinate_level === MatchLevel.CITY.num ? MatchLevel.CITY : MatchLevel.MACHIAZA;
          results.push({
            ...row,
            key,
            match_level: MatchLevel.MACHIAZA,
            coordinate_level,
          });
          if (!row.oaza_cho || row.oaza_cho === "番町" || row.oaza_cho.length < 3) {
            return;
          }

          if (row.oaza_cho.endsWith("番町")) {
            results.push({
              ...row,
              key: key.replace("番町", ""),
              match_level: MatchLevel.MACHIAZA,
              coordinate_level,
            });
            return;
          }
          if (row.oaza_cho.endsWith("町")) {
            results.push({
              ...row,
              key: key.replace("町", ""),
              match_level: MatchLevel.MACHIAZA,
              coordinate_level,
            });
          }
        });

        return Promise.resolve(results);
      });
  }

  getCityAndWardListGeneratorHash() : string {
    return this.getCityListGeneratorHash();
  }

  // -----------------------------------------
  // 〇〇市〇〇区 のHashMapを返す
  // -----------------------------------------
  async getCityAndWardList(): Promise<CityMatchingInfo[]> {
    const cityMap = await this.getCityMap();
    
    const results: CityMatchingInfo[] = [];
    for (const city_key of cityMap.keys()) {
      const city = cityMap.get(city_key)!;
      if (city.city.endsWith('区')) {
        continue;
      }
      results.push({
        key: [(city.city || ''), (city.ward || '')].join(''),
        ...city,
      });

      // 〇〇区からいきなり始まる可能性
      if (city.ward) {
        results.push({
          key: city.ward,
          ...city,
        });
      }
    }
    return results;
  }

  private getWardsSQL() {
    return `
      SELECT
        p.pref_key,
        c.city_key,
        p.${DataField.PREF.dbColumn} as pref,
        c.${DataField.CITY.dbColumn} as city,
        c.${DataField.COUNTY.dbColumn} as county,
        c.${DataField.WARD.dbColumn} as ward,
        c.${DataField.LG_CODE.dbColumn} as lg_code,
        c.${DataField.WARD.dbColumn} as key,

        c.${DataField.REP_LAT.dbColumn} as rep_lat,
        c.${DataField.REP_LON.dbColumn} as rep_lon
      FROM
        ${DbTableName.PREF} as p
        JOIN ${DbTableName.CITY} as c ON p.pref_key = c.pref_key
      WHERE
        c.${DataField.WARD.dbColumn} != '' AND c.${DataField.WARD.dbColumn} IS NOT NULL

    `;
  }
  getWardsGeneratorHash() : string {
    return crc32Lib.fromString(this.getWardsSQL());
  }
  
  async getWards(): Promise<WardMatchingInfo[]> {
    type WardRow = Omit<WardMatchingInfo, 'coordinate_level'>;
    
    const sql = this.getWardsSQL();
    const results: WardRow[] = this.prepare<unknown[], WardRow>(sql).all();
    
    return results.map(row => {
      return {
        ...row,
        match_level: MatchLevel.CITY,
        coordinate_level: MatchLevel.CITY,
      };
    });
  }

  getTokyo23WardsGeneratorHash() : string {
    return crc32Lib.fromString(this.getTokyo23Wards.toString());
  }

  async getTokyo23Wards(): Promise<CityMatchingInfo[]> {

    const cityMap = await this.getCityMap();

    const tokyo_pref_key = TableKeyProvider.getPrefKey({
      lg_code: PrefLgCode.TOKYO,
    });

    const results: CityMatchingInfo[] = [];
    for (const city_key of cityMap.keys()) {
      const city = cityMap.get(city_key)!;
      if (city.pref_key !== tokyo_pref_key) {
        continue;
      }
      if (!city.city.endsWith('区')) {
        continue;
      }
      results.push({
        key: city.city,
        ...city,
      });
    }
    return results;
  }
}
