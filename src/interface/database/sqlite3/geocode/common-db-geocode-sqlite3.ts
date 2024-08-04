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
import { TableKeyProvider } from "@domain/services/table-key-provider";
import { ChomeMachingInfo } from "@domain/types/geocode/chome-info";
import { CityInfo, CityMatchingInfo } from "@domain/types/geocode/city-info";
import { KoazaMachingInfo } from "@domain/types/geocode/koaza-info";
import { OazaChoMachingInfo } from "@domain/types/geocode/oaza-cho-info";
import { PrefInfo } from "@domain/types/geocode/pref-info";
import { TownInfo, TownMatchingInfo } from "@domain/types/geocode/town-info";
import { WardMatchingInfo } from "@domain/types/geocode/ward-info";
import { PrefLgCode } from "@domain/types/pref-lg-code";
import { LRUCache } from "lru-cache";
import stringHash from "string-hash";
import { ICommonDbGeocode } from "../../common-db";
import { Sqlite3Wrapper } from "../better-sqlite3-wrap";

type GetWardRowsOptions = {
  ward: string;
  city_key: number;
};
type GetOazaChoPatternsOptions = {
  pref_key: number;
  city_key: number;
  town_key: number;
};
type GetKoazaRowsOptions = {
  city_key: number;
  oaza_cho: string;
  chome: string;
};
type GetChomeRowsOptions = {
  pref_key: number;
  city_key: number;
  town_key: number;
  oaza_cho: string;
};

export class CommonDbGeocodeSqlite3 extends Sqlite3Wrapper implements ICommonDbGeocode {

  private readonly resultCache = new LRUCache<string, any>({
    max: 20,
  });

  getTownInfoByKey(town_key: number): Promise<TownInfo | undefined> {
    return Promise.resolve(this.prepare<{
      town_key: number;
    }, TownInfo>(`
      SELECT
        town_key,
        ${DataField.OAZA_CHO.dbColumn} as oaza_cho,
        ${DataField.CHOME.dbColumn} as chome,
        ${DataField.KOAZA.dbColumn} as koaza,
        ${DataField.MACHIAZA_ID.dbColumn} as machiaza_id,
        ${DataField.RSDT_ADDR_FLG.dbColumn} as rsdt_addr_flg
      from 
        ${DbTableName.TOWN}
      where
        town_key = @town_key
    `).get({
      town_key,
    }));
  }

  getCityInfoByKey(city_key: number): Promise<CityInfo | undefined> {
    return Promise.resolve(this.prepare<{
      city_key: number;
    }, CityInfo>(`
      SELECT
        city_key,
        pref_key,
        ${DataField.COUNTY.dbColumn} as county,
        ${DataField.CITY.dbColumn} as city,
        ${DataField.WARD.dbColumn} as ward,
        ${DataField.LG_CODE.dbColumn} as lg_code,
        ${DataField.REP_LAT.dbColumn} as rep_lat,
        ${DataField.REP_LON.dbColumn} as rep_lon
      FROM
        ${DbTableName.CITY}
      WHERE
        city_key = @city_key
    `).get({
      city_key,
    }));
  }

  getPrefInfoByKey(pref_key: number): Promise<PrefInfo | undefined> {
    const results = this.prepare<{
      pref_key: number;
    }, PrefInfo>(`
      SELECT
        pref_key,
        ${DataField.LG_CODE.dbColumn} as lg_code,
        ${DataField.PREF.dbColumn} as pref,
        ${DataField.REP_LAT.dbColumn} as rep_lat,
        ${DataField.REP_LON.dbColumn} as rep_lon
      FROM
        ${DbTableName.PREF}
      WHERE
        pref_key = @pref_key
    `).get({
      pref_key,
    });
    return Promise.resolve(results);
  }

  getKoazaRows(where: Partial<GetKoazaRowsOptions>): Promise<KoazaMachingInfo[]> {
    const conditions: string[] = [];
    if (where.city_key) {
      conditions.push(`c.city_key = @city_key`);
    }
    if (where.oaza_cho) {
      conditions.push(`t.${DataField.OAZA_CHO.dbColumn} = @oaza_cho`);
    }
    if (where.chome) {
      conditions.push(`t.${DataField.CHOME.dbColumn} = @chome`);
    }
    const WHERE_CONDITION = conditions.join(' AND ');

    const results = this.prepare<Partial<GetKoazaRowsOptions>, KoazaMachingInfo>(`
      SELECT
        c.city_key,
        t.town_key,
        c.pref_key,
        p.${DataField.PREF.dbColumn} as pref,
        t.${DataField.CHOME.dbColumn} as chome,
        p.${DataField.PREF.dbColumn} as pref,
        c.${DataField.CITY.dbColumn} as city,
        c.${DataField.COUNTY.dbColumn} as county,
        c.${DataField.WARD.dbColumn} as ward,
        c.${DataField.LG_CODE.dbColumn} AS lg_code,
        t.${DataField.OAZA_CHO.dbColumn} as oaza_cho,
        t.${DataField.RSDT_ADDR_FLG.dbColumn} as rsdt_addr_flg,
        t.${DataField.KOAZA.dbColumn} as koaza,
        t.${DataField.MACHIAZA_ID.dbColumn} as machiaza_id,
        t.${DataField.REP_LAT.dbColumn} as rep_lat,
        t.${DataField.REP_LON.dbColumn} as rep_lon
      FROM
        ${DbTableName.PREF} p
        JOIN ${DbTableName.CITY} c ON p.pref_key = c.pref_key
        JOIN ${DbTableName.TOWN} t ON c.city_key = t.city_key
      WHERE
        t.${DataField.KOAZA.dbColumn} != '' AND
        t.${DataField.KOAZA.dbColumn} IS NOT NULL AND
        ${WHERE_CONDITION}
    `).all(where);

    return Promise.resolve(results);
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
    const results = this.prepare<Partial<GetChomeRowsOptions>, ChomeMachingInfo>(`
      SELECT
        c.pref_key,
        c.city_key,
        t.town_key,
        p.${DataField.PREF.dbColumn} as pref,
        t.${DataField.CHOME.dbColumn} as chome,
        p.${DataField.PREF.dbColumn} as pref,
        c.${DataField.CITY.dbColumn} as city,
        c.${DataField.COUNTY.dbColumn} as county,
        c.${DataField.WARD.dbColumn} as ward,
        c.${DataField.LG_CODE.dbColumn} AS lg_code,
        t.${DataField.OAZA_CHO.dbColumn} as oaza_cho,
        t.${DataField.RSDT_ADDR_FLG.dbColumn} as rsdt_addr_flg,
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
    `).all(where);

    return Promise.resolve(results);
  }

  async getOazaChoPatterns(where: Partial<GetOazaChoPatternsOptions>): Promise<OazaChoMachingInfo[]> {
    const sql = `
      SELECT
        town_key,
        city_key,
        (substr(${DataField.MACHIAZA_ID.dbColumn}, 1, 4) || '000') AS machiaza_id,
        ${DataField.REP_LAT.dbColumn} as rep_lat,
        ${DataField.REP_LON.dbColumn} as rep_lon,
        ${DataField.OAZA_CHO.dbColumn} as oaza_cho,
        ${DataField.CHOME.dbColumn} as chome,
        ${DataField.KOAZA.dbColumn} as koaza,
        ${DataField.MACHIAZA_ID.dbColumn} as machiaza_id,
        ${DataField.RSDT_ADDR_FLG.dbColumn} as rsdt_addr_flg,
        (${DataField.OAZA_CHO.dbColumn}) as key
      FROM
        ${DbTableName.TOWN}
      WHERE
        ${DataField.OAZA_CHO.dbColumn} != '' AND
        ${DataField.OAZA_CHO.dbColumn} IS NOT NULL
    `;

    const [
      prefMap,
      cityMap,
      towns,
    ] = await Promise.all([
      this.getPrefMap(),

      this.getCityMap(),
      
      new Promise((resolve: (rows: Omit<OazaChoMachingInfo, 'pref' | 'pref_key'>[]) => void) => {
        if (this.resultCache.has('town_cache')) {
          resolve(this.resultCache.get('town_cache'));
          return;
        }
        const rows = this.prepare<
          Partial<GetOazaChoPatternsOptions>,
          Omit<OazaChoMachingInfo, 'pref' | 'pref_key'>
        >(sql).all(where);
        this.resultCache.set('town_cache', rows);
        resolve(rows);
      }),
    ]);
    
    const results: OazaChoMachingInfo[] = towns
      .filter(town => {
        if (!where?.town_key) {
          return true;
        }
        return town.town_key === where.town_key;
      })
      .map(town => {
        const city = cityMap.get(town.city_key)!;
        return {
          ...town,
          city: city.city,
          pref_key: city.pref_key,
          pref: prefMap.get(city.pref_key)!.pref,
          rep_lat: town.rep_lat || city.rep_lat,
          rep_lon: town.rep_lon || city.rep_lon,
        };
      });
    
    return results;

    // const conditions: string[] = [];
    // if (where.pref_key) {
    //   conditions.push(`c.pref_key = @pref_key`);
    // }
    // if (where.city_key) {
    //   conditions.push(`c.city_key = @city_key`);
    // }
    // if (where.town_key) {
    //   conditions.push(`t.town_key = @town_key`);
    // }

    // const sql = `
    //   SELECT
    //     p.pref_key,
    //     c.city_key,
    //     t.town_key,
    //     (substr(t.${DataField.MACHIAZA_ID.dbColumn}, 1, 4) || '000') AS machiaza_id,
    //     p.${DataField.PREF.dbColumn} AS pref,
    //     c.${DataField.CITY.dbColumn} AS city,
    //     c.${DataField.COUNTY.dbColumn} AS county,
    //     c.${DataField.WARD.dbColumn} AS ward,
    //     c.${DataField.LG_CODE.dbColumn} AS lg_code,
    //     t.${DataField.REP_LAT.dbColumn} as rep_lat,
    //     t.${DataField.REP_LON.dbColumn} as rep_lon,
    //     t.${DataField.OAZA_CHO.dbColumn} as oaza_cho,
    //     t.${DataField.CHOME.dbColumn} as chome,
    //     t.${DataField.KOAZA.dbColumn} as koaza,
    //     t.${DataField.MACHIAZA_ID.dbColumn} as machiaza_id,
    //     t.${DataField.RSDT_ADDR_FLG.dbColumn} as rsdt_addr_flg,
        
    //     -- IIF (
    //     --   -- if conditions are true,
    //     --   t.${DataField.OAZA_CHO.dbColumn} != '番町',

    //     --   -- then
    //     --   (t.${DataField.OAZA_CHO.dbColumn} || t.${DataField.CHOME.dbColumn} || t.${DataField.KOAZA.dbColumn}),
          
    //     --   -- else
    //     --   (t.${DataField.OAZA_CHO.dbColumn} || t.${DataField.CHOME.dbColumn})
    //     -- )
    //     (t.${DataField.OAZA_CHO.dbColumn} || t.${DataField.CHOME.dbColumn}) as key
    //   FROM
    //     ${DbTableName.PREF} p
    //     JOIN ${DbTableName.CITY} c ON p.pref_key = c.pref_key
    //     JOIN ${DbTableName.TOWN} t ON c.city_key = t.city_key
    //   WHERE
    //     t.${DataField.OAZA_CHO.dbColumn} != '' AND
    //     t.${DataField.OAZA_CHO.dbColumn} IS NOT NULL AND
    //     ${WHERE_CONDITION}
    // `;

    // return this.prepare<any, OazaChoMachingInfo>(sql).all(where);
  }


  async getWardRows(where: Required<GetWardRowsOptions>): Promise<WardMatchingInfo[]> {
    return new Promise((resolve: (rows: WardMatchingInfo[]) => void) => {
      const rows = this.prepare<GetWardRowsOptions, WardMatchingInfo>(`
        SELECT
          p.pref_key,
          c.city_key,
          (substr(t.${DataField.MACHIAZA_ID.dbColumn}, 1, 4) || '000') AS machiaza_id,
          p.${DataField.PREF.dbColumn} AS pref,
          c.${DataField.CITY.dbColumn} AS city,
          c.${DataField.COUNTY.dbColumn} AS county,
          c.${DataField.WARD.dbColumn} AS ward,
          c.${DataField.LG_CODE.dbColumn} AS lg_code,
          t.${DataField.OAZA_CHO.dbColumn} AS oaza_cho,
          t.${DataField.RSDT_ADDR_FLG.dbColumn} AS rsdt_addr_flg,
          c.${DataField.REP_LAT.dbColumn} as rep_lat,
          c.${DataField.REP_LON.dbColumn} as rep_lon,
          (c.${DataField.CITY.dbColumn} || c.${DataField.WARD.dbColumn} || t.${DataField.OAZA_CHO.dbColumn}) AS key
        FROM
          ${DbTableName.PREF} p
          JOIN ${DbTableName.CITY} c ON p.pref_key = c.pref_key
          JOIN ${DbTableName.TOWN} t ON c.city_key = t.city_key
        WHERE
          c.city_key = @city_key AND 
          t.${DataField.OAZA_CHO.dbColumn} != '' AND
          (c.${DataField.WARD.dbColumn} = @ward OR c.${DataField.CITY.dbColumn} = @ward)
        GROUP BY key
      `).all(where);

      resolve(rows);
    });
  }

  async getPrefMap(): Promise<Map<number, PrefInfo>> {
    if (this.resultCache.has('pref_map')) {
      return this.resultCache.get('pref_map') as Map<number, PrefInfo>;
    }
    const prefRows = await this.getPrefList();
    const prefMap = new Map<number, PrefInfo>();
    prefRows.forEach(pref => {
      prefMap.set(pref.pref_key, pref);
    });
    this.resultCache.set('pref_map', prefMap);
    return prefMap;
  }
  
  // ------------------------------------
  // prefテーブルを HashMapにして返す
  // ------------------------------------
  async getPrefList(): Promise<PrefInfo[]> {
    if (this.resultCache.has('pref_list')) {
      return this.resultCache.get('pref_list') as PrefInfo[];
    }
    return new Promise((resolve: (rows: PrefInfo[]) => void) => {
      const rows = this.prepare<unknown[], PrefInfo>(`
        SELECT
          pref_key,
          ${DataField.LG_CODE.dbColumn} as lg_code,
          ${DataField.PREF.dbColumn} as pref,
          ${DataField.REP_LAT.dbColumn} as rep_lat,
          ${DataField.REP_LON.dbColumn} as rep_lon
        FROM
          ${DbTableName.PREF}
      `).all();
  
      this.resultCache.set('pref_list', rows);
      resolve(rows);
    });
  }

  async getCityList(): Promise<CityInfo[]> {
    if (this.resultCache.has('city_list')) {
      return this.resultCache.get('city_list') as CityInfo[];
    }

    const [
      prefMap,
      cityRows,
    ] = await Promise.all([
      this.getPrefMap(),
      new Promise((resolve: (rows:  Omit<CityInfo, 'pref'>[]) => void) => {
        const townRows = this.prepare<unknown[],  Omit<CityInfo, 'pref'>>(`
          SELECT
            city_key,
            pref_key,
            ${DataField.LG_CODE.dbColumn},
            ${DataField.COUNTY.dbColumn},
            ${DataField.CITY.dbColumn},
            ${DataField.WARD.dbColumn},
            ${DataField.REP_LAT.dbColumn},
            ${DataField.REP_LON.dbColumn}
          FROM
            ${DbTableName.CITY}
        `).all();
        resolve(townRows);
      }),
    ]);

    const results = cityRows.map(city => {
      return {
        ...city,
        pref: prefMap.get(city.pref_key)!.pref,
      }
    });

    this.resultCache.set('city_list', results);
    return results;
  }
  

  private async getCityMap(): Promise<Map<number, CityInfo>> {
    if (this.resultCache.has('city_map')) {
      return this.resultCache.get('city_map') as Map<number, CityInfo>;
    }

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

    this.resultCache.set('city_map', cityMap);
    return cityMap;
  }
  
  async getOazaChomes(): Promise<OazaChoMachingInfo[]> {
    // const rows = this.prepare<unknown[], OazaChoMachingInfo>(`
    //   SELECT
    //     p.pref_key,
    //     c.city_key,
    //     t.town_key,
    //     c.${DataField.LG_CODE.dbColumn} as lg_code,
    //     p.${DataField.PREF.dbColumn} as pref,
    //     c.${DataField.COUNTY.dbColumn} as county,
    //     c.${DataField.CITY.dbColumn} as city,
    //     c.${DataField.WARD.dbColumn} as ward,
    //     t.${DataField.MACHIAZA_ID.dbColumn} as machiaza_id,
    //     t.${DataField.OAZA_CHO.dbColumn} as oaza_cho,
    //     t.${DataField.CHOME.dbColumn} as chome,
    //     t.${DataField.KOAZA.dbColumn} as koaza,
    //     t.${DataField.RSDT_ADDR_FLG.dbColumn} as rsdt_addr_flg,
    //     (t.${DataField.OAZA_CHO.dbColumn} || t.${DataField.CHOME.dbColumn} || t.${DataField.KOAZA.dbColumn}) as key,

    //     COALESCE(
    //       t.${DataField.REP_LAT.dbColumn},
    //       c.${DataField.REP_LAT.dbColumn}
    //     ) AS rep_lat,

    //     COALESCE (
    //       t.${DataField.REP_LON.dbColumn},
    //       c.${DataField.REP_LON.dbColumn}
    //     ) AS rep_lon
    //   FROM
    //     ${DbTableName.PREF} p
    //     JOIN ${DbTableName.CITY} c ON p.pref_key = c.pref_key
    //     JOIN ${DbTableName.TOWN} t ON c.city_key = t.city_key
    //   WHERE
    //     t.${DataField.OAZA_CHO.dbColumn} != '' AND
    //     t.${DataField.OAZA_CHO.dbColumn} IS NOT NULL
    // `).all();

    type TownRow = {
      town_key: number;
      city_key: number;
      machiaza_id: string;
      oaza_cho: string;
      chome: string;
      koaza: string;
      rsdt_addr_flg: number;
      rep_lat: number;
      rep_lon: number;
    };

    const [
      prefMap,
      cityMap,
      townRows,
    ] = await Promise.all([
      this.getPrefMap(),
      this.getCityMap(),
      new Promise((resolve: (rows: TownRow[]) => void) => {
        const townRows = this.prepare<unknown[], TownRow>(`
          SELECT
            town_key,
            city_key,
            ${DataField.MACHIAZA_ID.dbColumn} as machiaza_id,
            ${DataField.OAZA_CHO.dbColumn} as oaza_cho,
            ${DataField.CHOME.dbColumn} as chome,
            ${DataField.KOAZA.dbColumn} as koaza,
            ${DataField.RSDT_ADDR_FLG.dbColumn} as rsdt_addr_flg,
            ${DataField.REP_LAT.dbColumn} as rep_lat,
            ${DataField.REP_LON.dbColumn} as rep_lon
          FROM
            ${DbTableName.TOWN}
          WHERE
            ${DataField.OAZA_CHO.dbColumn} != '' AND
            ${DataField.OAZA_CHO.dbColumn} IS NOT NULL
        `).all();
        resolve(townRows);
      }),
    ]);

    const rows: OazaChoMachingInfo[] = townRows.map(townRow => {
      const key = [townRow.oaza_cho, townRow.chome, townRow.koaza]
        .filter(x => x !== null && x !== '')
        .join('');
      
      const city = cityMap.get(townRow.city_key)!;
      const pref = prefMap.get(city.pref_key)!.pref;

      return {
        key,
        pref: pref,
        city: city.city,
        county: city.county,
        ward: city.ward,
        chome: townRow.chome,
        lg_code: city.lg_code,
        oaza_cho: townRow.oaza_cho,
        koaza: townRow.koaza,
        machiaza_id: townRow.machiaza_id,
        pref_key: city.pref_key,
        city_key: townRow.city_key,
        town_key: townRow.town_key,
        rep_lat: townRow.rep_lat || city.rep_lat,
        rep_lon: townRow.rep_lon || city.rep_lon,
        rsdt_addr_flg: townRow.rsdt_addr_flg,
      };
    });

    // 存在しない「大字丁目」の場合、「大字」までヒットさせたい、という仕様要求のため
    // 「大字」までのデータも作成する
    //
    // 例：「霞が関４丁目」の場合、「４丁目」は存在しないが、「霞が関」は存在する
    // なので「霞が関」までヒットさせたい
    const added = new Set<number>();
    townRows.forEach(townRow => {
      const key = townRow.oaza_cho;
      
      const city = cityMap.get(townRow.city_key)!;
      const pref = prefMap.get(city.pref_key)!.pref;
      const machiaza_id = `${townRow.machiaza_id.substring(0, 4)}000`;
      const oazaKey = stringHash([city.city_key.toString(), townRow.oaza_cho, machiaza_id].join(''));
      if (added.has(oazaKey)) {
        return;
      }
      added.add(oazaKey);

      rows.push({
        key,
        pref: pref,
        city: city.city,
        county: city.county,
        ward: city.ward,
        chome: '',
        lg_code: city.lg_code,
        oaza_cho: townRow.oaza_cho,
        koaza: '',
        machiaza_id,
        pref_key: city.pref_key,
        city_key: townRow.city_key,
        town_key: townRow.town_key,
        rep_lat: city.rep_lat,
        rep_lon: city.rep_lon,
        rsdt_addr_flg: AMBIGUOUS_RSDT_ADDR_FLG,
      });
    });

    return rows;
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
      
      type SQLParams = {
        tokyo_pref_key: number | null,
      }
      const params = {
        tokyo_pref_key: TableKeyProvider.getPrefKey({
          lg_code: PrefLgCode.TOKYO,
        }),
      };

      const results = this.prepare<SQLParams, TownMatchingInfo>(`
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
          t.${DataField.RSDT_ADDR_FLG.dbColumn} as rsdt_addr_flg,
          t.${DataField.REP_LAT.dbColumn} as rep_lat,
          t.${DataField.REP_LON.dbColumn} as rep_lon
        from 
          ${DbTableName.PREF} p
          JOIN ${DbTableName.CITY} c ON p.pref_key = c.pref_key
          JOIN ${DbTableName.TOWN} t ON c.city_key = t.city_key
        where
          c.${DataField.CITY.dbColumn} like '%区' AND
          c.pref_key = @tokyo_pref_key
      `).all(params);
      resolve(results);
    });
  };

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
    

    // const rows = this.prepare<unknown[], CityMatchingInfo>(`
    //   SELECT
    //     c.city_key,
    //     c.pref_key,
    //     p.${DataField.PREF.dbColumn} as pref,
    //     c.${DataField.LG_CODE.dbColumn} as lg_code,
    //     c.${DataField.COUNTY.dbColumn} as county,
    //     c.${DataField.CITY.dbColumn} as city,
    //     c.${DataField.WARD.dbColumn} as ward,
    //     c.${DataField.REP_LAT.dbColumn} as rep_lat,
    //     c.${DataField.REP_LON.dbColumn} as rep_lon,
    //     (c.${DataField.COUNTY.dbColumn} || c.${DataField.CITY.dbColumn} ) as key
    //   FROM
    //     ${DbTableName.PREF} p
    //     JOIN ${DbTableName.CITY} c ON p.pref_key = c.pref_key
    //   WHERE
    //     c.${DataField.COUNTY.dbColumn} != ''
    // `).all();
    // return rows;
  }

  // -----------------------------------------
  // 〇〇区△△ のHashMapを返す（△△は大字）
  // -----------------------------------------
  getWardAndOazaChoList(): Promise<OazaChoMachingInfo[]> {
    const rows = this.prepare<unknown[], OazaChoMachingInfo>(`
      SELECT
        c.city_key,
        c.pref_key,
        p.${DataField.PREF.dbColumn} as pref,
        c.${DataField.LG_CODE.dbColumn} as lg_code,
        c.${DataField.COUNTY.dbColumn} as county,
        c.${DataField.CITY.dbColumn} as city,
        c.${DataField.WARD.dbColumn} as ward,
        t.${DataField.OAZA_CHO.dbColumn} as oaza_cho,
        (substr(t.${DataField.MACHIAZA_ID.dbColumn}, 1, 4) || '000') AS machiaza_id,
        c.${DataField.REP_LAT.dbColumn} as rep_lat,
        c.${DataField.REP_LON.dbColumn} as rep_lon,
        (c.${DataField.WARD.dbColumn} || t.${DataField.OAZA_CHO.dbColumn}) as key
      FROM
        ${DbTableName.PREF} p
        JOIN ${DbTableName.CITY} c ON p.pref_key = c.pref_key
        JOIN ${DbTableName.TOWN} t ON c.city_key = t.city_key
      WHERE
        c.${DataField.CITY.dbColumn} != '' AND
        c.${DataField.WARD.dbColumn} != '' AND
        t.${DataField.OAZA_CHO.dbColumn} != '' AND
        t.${DataField.OAZA_CHO.dbColumn} IS NOT NULL
      GROUP BY
        (c.${DataField.WARD.dbColumn} || t.${DataField.OAZA_CHO.dbColumn})
    `).all();
    return Promise.resolve(rows);
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
    }
    return results;

    // const rows = this.prepare<unknown[], CityMatchingInfo>(`
    //   SELECT
    //     c.city_key,
    //     c.pref_key,
    //     p.${DataField.PREF.dbColumn} as pref,
    //     c.${DataField.COUNTY.dbColumn} as county,
    //     c.${DataField.CITY.dbColumn} as city,
    //     c.${DataField.WARD.dbColumn} as ward,
    //     c.${DataField.LG_CODE.dbColumn} as lg_code,
    //     c.${DataField.REP_LAT.dbColumn} as rep_lat,
    //     c.${DataField.REP_LON.dbColumn} as rep_lon,
    //     (c.${DataField.CITY.dbColumn} || c.${DataField.WARD.dbColumn}) as key
    //   FROM
    //     ${DbTableName.PREF} p
    //     JOIN ${DbTableName.CITY} c ON p.pref_key = c.pref_key
    //   WHERE

    //     -- 東京23区は city.city に「〇〇区」が入っていて
    //     -- 他の道府県の「〇〇区」と同名のときにミスマッチしてしまうので、含まない
    //     c.${DataField.CITY.dbColumn} NOT LIKE '%区'
    // `).all();

    // return rows;
  }

  async getWards(): Promise<WardMatchingInfo[]> {
    const cityMap = await this.getCityMap();
    
    const results: WardMatchingInfo[] = [];
    for (const city_key of cityMap.keys()) {
      const city = cityMap.get(city_key)!;
      if (city.ward === '' || !city.ward || !city.city.endsWith('区')) {
        continue;
      }
      results.push({
        key: [(city.city || ''), city.ward].join(''),
        ...city,
        oaza_cho: ""
      });
    }
    return results;

    // return this.prepare<unknown[], WardMatchingInfo>(`
    //   SELECT
    //     (c.${DataField.CITY.dbColumn} || c.${DataField.WARD.dbColumn}) as key,
    //     c.pref_key,
    //     c.city_key,
    //     c.${DataField.LG_CODE.dbColumn} as lg_code,
    //     p.${DataField.PREF.dbColumn} as pref,
    //     c.${DataField.CITY.dbColumn} as city,
    //     c.${DataField.COUNTY.dbColumn} as county,
    //     c.${DataField.WARD.dbColumn} as ward,
    //     c.${DataField.REP_LAT.dbColumn} as rep_lat,
    //     c.${DataField.REP_LON.dbColumn} as rep_lon
    //   FROM 
    //     ${DbTableName.PREF} p
    //     JOIN ${DbTableName.CITY} c ON p.pref_key = c.pref_key
    //   WHERE
    //     (c.${DataField.WARD.dbColumn} != '' OR 
    //     c.${DataField.CITY.dbColumn} like '%区')
    //   GROUP BY
    //     key, c.pref_key, c.city_key
    // `).all();
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

    // const params = {
    //   tokyo_pref_key: TableKeyProvider.getPrefKey({
    //     lg_code: PrefLgCode.TOKYO,
    //   }),
    // };
    // return this.prepare<unknown[], CityMatchingInfo>(`
    //   SELECT
    //     c.pref_key,
    //     c.city_key,
    //     c.${DataField.CITY.dbColumn} as key,
    //     p.${DataField.PREF.dbColumn} as pref,
    //     c.${DataField.CITY.dbColumn} as city,
    //     c.${DataField.COUNTY.dbColumn} as county,
    //     c.${DataField.WARD.dbColumn} as ward,
    //     c.${DataField.LG_CODE.dbColumn} as lg_code,
    //     c.${DataField.REP_LAT.dbColumn} as rep_lat,
    //     c.${DataField.REP_LON.dbColumn} as rep_lon
    //   from 
    //     ${DbTableName.PREF} p
    //     JOIN ${DbTableName.CITY} c ON p.pref_key = c.pref_key
    //   where
    //     c.${DataField.CITY.dbColumn} like '%区' AND
    //     c.pref_key = @tokyo_pref_key
    // `).all(params);
  }
}