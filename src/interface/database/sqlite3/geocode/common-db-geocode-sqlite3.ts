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
import { RegExpEx } from "@domain/services/reg-exp-ex";
import { TableKeyProvider } from "@domain/services/table-key-provider";
import { ChomeMachingInfo } from "@domain/types/geocode/chome-info";
import { CityInfo, CityMatchingInfo } from "@domain/types/geocode/city-info";
import { KoazaMachingInfo } from "@domain/types/geocode/koaza-info";
import { MatchLevel } from "@domain/types/geocode/match-level";
import { OazaChoMachingInfo } from "@domain/types/geocode/oaza-cho-info";
import { PrefInfo } from "@domain/types/geocode/pref-info";
import { TownMatchingInfo } from "@domain/types/geocode/town-info";
import { WardMatchingInfo } from "@domain/types/geocode/ward-info";
import { PrefLgCode } from "@domain/types/pref-lg-code";
import { ICommonDbGeocode } from "../../common-db";
import { Sqlite3Wrapper } from "../better-sqlite3-wrap";
import { TrieAddressFinder } from "@usecases/geocode/models/trie/trie-finder";
import { CharNode } from "@usecases/geocode/models/trie/char-node";
import { WardAndOazaMatchingInfo } from "@domain/types/geocode/ward-oaza-info";

// type GetOazaChoPatternsOptions = {
//   pref_key: number;
//   city_key: number;
//   town_key: number;
// };
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

  getKyotoStreetRows(): Promise<KoazaMachingInfo[]> {
    const results = this.prepare<{}, KoazaMachingInfo>(`
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

        -- koaza_aka_code = 2 のときは、京都の通り名
        -- koaza に通り名が格納されている
        -- (通り名)(大字) になっているので、keyに大字を含める
        (
          t.${DataField.KOAZA.dbColumn} ||
          t.${DataField.OAZA_CHO.dbColumn}
        ) as key,
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
        t.${DataField.KOAZA_AKA_CODE.dbColumn} = 2
    `).all({});

    return Promise.resolve(results);
  }

  getKoazaRows(where: Partial<GetKoazaRowsOptions>): Promise<KoazaMachingInfo[]> {
    const conditions: string[] = [];
    if (where.city_key) {
      conditions.push(`c.city_key = @city_key`);
    }
    if (where.oaza_cho) {

      if (RegExpEx.create('[ヶケ]').test(where.oaza_cho)) {
        // SQLiteで `_` は、何にでもマッチする文字
        where.oaza_cho = where.oaza_cho.replace(RegExpEx.create('[ケヶ]'), '_');
        conditions.push(`t.${DataField.OAZA_CHO.dbColumn} LIKE @oaza_cho`);
      } else {
        conditions.push(`t.${DataField.OAZA_CHO.dbColumn} = @oaza_cho`);
      }
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
        t.${DataField.KOAZA.dbColumn} as key,
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
        t.${DataField.KOAZA_AKA_CODE.dbColumn} != 2 AND
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
  
  // ------------------------------------
  // prefテーブルを HashMapにして返す
  // ------------------------------------
  async getPrefList(): Promise<PrefInfo[]> {
    // if (this.resultCache.has('pref_list')) {
    //   return this.resultCache.get('pref_list') as PrefInfo[];
    // }
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
  
      // this.resultCache.set('pref_list', rows);
      resolve(rows);
    });
  }

  async getCityList(): Promise<CityInfo[]> {
    type CityRow = Omit<CityInfo, 'pref'>;

    const [
      prefMap,
      cityRows,
    ] = await Promise.all([
      this.getPrefMap(),
      new Promise((resolve: (rows:  Omit<CityInfo, 'pref'>[]) => void) => {
        const townRows = this.prepare<unknown[],  CityRow>(`
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
        `).all();

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
  
  async getOazaChomes(): Promise<OazaChoMachingInfo[]> {
    type TownRow = {
      pkey: string;
      match_level: number;
      town_key: number;
      city_key: number;
      machiaza_id: string;
      oaza_cho: string;
      chome: string;
      koaza: string;
      rsdt_addr_flg: number;
      coordinate_level: number;
      rep_lat?: string;
      rep_lon?: string;
    };

    const [
      prefMap,
      cityMap,
    ] = await Promise.all([
      this.getPrefMap(),
      this.getCityMap(),
    ]);
    
    const townRows = await new Promise((resolve: (rows: TownRow[]) => void) => {

      this.exec('BEGIN TRANSACTION');

      this.exec(`
        CREATE TEMP TABLE resultTable (
          pkey TEXT PRIMARY KEY,
          town_key INTEGER DEFAULT null,
          city_key INTEGER,
          machiaza_id TEXT,
          oaza_cho TEXT,
          chome TEXT,
          koaza TEXT,
          rsdt_addr_flg INTEGER,
          rep_lat TEXT,
          rep_lon TEXT,
          match_level INTEGER,
          coordinate_level INTEGER
        );
      `);

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
      this.exec(`
        REPLACE INTO resultTable
        SELECT
          (city_key || ${DataField.OAZA_CHO.dbColumn} || ${DataField.OAZA_CHO.dbColumn} || ${DataField.CHOME.dbColumn}) as pkey,
          town_key,
          city_key,
          ${DataField.MACHIAZA_ID.dbColumn} as machiaza_id,
          ${DataField.OAZA_CHO.dbColumn} as oaza_cho,
          ${DataField.CHOME.dbColumn} as chome,
          '' as koaza,
          ${DataField.RSDT_ADDR_FLG.dbColumn} as rsdt_addr_flg,
          ${DataField.REP_LAT.dbColumn} as rep_lat,
          ${DataField.REP_LON.dbColumn} as rep_lon,
          ${MatchLevel.MACHIAZA_DETAIL.num} as match_level,
          IIF(
            ${DataField.REP_LAT.dbColumn} = '' OR ${DataField.REP_LAT.dbColumn} IS NULL,
            ${MatchLevel.UNKNOWN.num},
            ${MatchLevel.MACHIAZA_DETAIL.num}
          ) as coordinate_level
        FROM
          ${DbTableName.TOWN}
        WHERE
          (
            ${DataField.OAZA_CHO.dbColumn} != '' AND
            ${DataField.OAZA_CHO.dbColumn} IS NOT NULL
          ) AND (
            ${DataField.CHOME.dbColumn} != '' AND
            ${DataField.CHOME.dbColumn} IS NOT NULL
          ) AND (
            ${DataField.KOAZA.dbColumn} = '' OR
            ${DataField.KOAZA.dbColumn} IS NULL
          )
      `);

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
      this.exec(`
        REPLACE INTO resultTable
        SELECT
          (city_key || ${DataField.OAZA_CHO.dbColumn}) as pkey,
          NULL as town_key,
          city_key,
          (substr(${DataField.MACHIAZA_ID.dbColumn}, 1, 4) || '000') as machiaza_id,
          ${DataField.OAZA_CHO.dbColumn} as oaza_cho,
          '' as chome,
          '' as koaza,
          ${AMBIGUOUS_RSDT_ADDR_FLG} as rsdt_addr_flg,  /* 0 と 1が混ざる可能性があるので、AMBIGUOUS_RSDT_ADDR_FLG */
          NULL as rep_lat,
          NULL as rep_lon,
          ${MatchLevel.MACHIAZA.num} as match_level,
          ${MatchLevel.UNKNOWN.num} as coordinate_level
        FROM
          ${DbTableName.TOWN}
        WHERE
          (
            ${DataField.OAZA_CHO.dbColumn} != '' AND
            ${DataField.OAZA_CHO.dbColumn} IS NOT NULL
          ) AND (
            ${DataField.CHOME.dbColumn} != '' AND
            ${DataField.CHOME.dbColumn} IS NOT NULL
          ) AND (
            ${DataField.KOAZA.dbColumn} = '' OR
            ${DataField.KOAZA.dbColumn} IS NULL
          )
        GROUP BY
          pkey
      `);

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
      this.exec(`
        INSERT INTO resultTable
        SELECT
          (city_key || '-' || ${DataField.KOAZA.dbColumn}) as pkey,
          town_key,
          city_key,
          ${DataField.MACHIAZA_ID.dbColumn} as machiaza_id,
          '' as oaza_cho,
          '' as chome,
          ${DataField.KOAZA.dbColumn} as koaza,
          ${DataField.RSDT_ADDR_FLG.dbColumn} as rsdt_addr_flg,
          ${DataField.REP_LAT.dbColumn} as rep_lat,
          ${DataField.REP_LON.dbColumn} as rep_lon,
          ${MatchLevel.MACHIAZA_DETAIL.num} as match_level,
          IIF(
            ${DataField.REP_LAT.dbColumn} = '' OR ${DataField.REP_LAT.dbColumn} IS NULL,
            ${MatchLevel.UNKNOWN.num},
            ${MatchLevel.MACHIAZA_DETAIL.num}
          ) as coordinate_level
        FROM
          ${DbTableName.TOWN}
        WHERE
          (
            ${DataField.OAZA_CHO.dbColumn} = '' OR
            ${DataField.OAZA_CHO.dbColumn} IS NULL
          ) AND (
            ${DataField.CHOME.dbColumn} = '' OR
            ${DataField.CHOME.dbColumn} IS NULL
          ) AND (
            ${DataField.KOAZA.dbColumn} != '' AND
            ${DataField.KOAZA.dbColumn} IS NOT NULL
          )
      `);

      /*
       * パターン： 〇〇(大字)〇〇(小字)
       */
      this.exec(`
        REPLACE INTO resultTable
        SELECT
          (city_key || ${DataField.OAZA_CHO.dbColumn} || ${DataField.KOAZA.dbColumn}) as pkey,
          town_key,
          city_key,
          ${DataField.MACHIAZA_ID.dbColumn} as machiaza_id,
          ${DataField.OAZA_CHO.dbColumn} as oaza_cho,
          '' as chome,
          ${DataField.KOAZA.dbColumn} as koaza,
          ${DataField.RSDT_ADDR_FLG.dbColumn} as rsdt_addr_flg,
          ${DataField.REP_LAT.dbColumn} as rep_lat,
          ${DataField.REP_LON.dbColumn} as rep_lon,
          ${MatchLevel.MACHIAZA_DETAIL.num} as match_level,
          IIF(
            ${DataField.REP_LAT.dbColumn} = '' OR ${DataField.REP_LAT.dbColumn} IS NULL,
            ${MatchLevel.UNKNOWN.num},
            ${MatchLevel.MACHIAZA_DETAIL.num}
          ) as coordinate_level
        FROM
          ${DbTableName.TOWN}
        WHERE
          (
            ${DataField.OAZA_CHO.dbColumn} != '' AND
            ${DataField.OAZA_CHO.dbColumn} IS NOT NULL
          ) AND (
            ${DataField.CHOME.dbColumn} = '' OR
            ${DataField.CHOME.dbColumn} IS NULL
          ) AND (
            ${DataField.KOAZA.dbColumn} != '' AND
            ${DataField.KOAZA.dbColumn} IS NOT NULL
          )
      `);

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
      this.exec(`
        REPLACE INTO resultTable
        SELECT
            (city_key || ${DataField.OAZA_CHO.dbColumn}) as pkey,
            town_key,
            city_key,
            ${DataField.MACHIAZA_ID.dbColumn} as machiaza_id,
            ${DataField.OAZA_CHO.dbColumn} as oaza_cho,
            ${DataField.CHOME.dbColumn} as chome,
            '' as koaza,
            ${DataField.RSDT_ADDR_FLG.dbColumn} as rsdt_addr_flg,
            ${DataField.REP_LAT.dbColumn} as rep_lat,
            ${DataField.REP_LON.dbColumn} as rep_lon,
            ${MatchLevel.MACHIAZA.num} as match_level,
            IIF(
              ${DataField.REP_LAT.dbColumn} = '' OR ${DataField.REP_LAT.dbColumn} IS NULL,
              ${MatchLevel.UNKNOWN.num},
              ${MatchLevel.MACHIAZA.num}
            ) as coordinate_level
          FROM
            ${DbTableName.TOWN}
          WHERE
            (
              ${DataField.OAZA_CHO.dbColumn} != '' AND
              ${DataField.OAZA_CHO.dbColumn} IS NOT NULL
            ) AND (
              ${DataField.CHOME.dbColumn} = '' OR
              ${DataField.CHOME.dbColumn} IS NULL
            ) AND (
              ${DataField.KOAZA.dbColumn} = '' OR
              ${DataField.KOAZA.dbColumn} IS NULL
            )
      `);

      // O(N x M)になって遅いので、コードで処理する
      // this.exec(`
      //   WITH other as (
      //     SELECT
      //       (city_key || ${DataField.OAZA_CHO.dbColumn}) as pkey,
      //       ${DataField.REP_LAT.dbColumn} as rep_lat,
      //       ${DataField.REP_LON.dbColumn} as rep_lon,
      //       IIF(
      //         ${DataField.REP_LAT.dbColumn} IS NULL,
      //         ${MatchLevel.UNKNOWN.num},
      //         ${MatchLevel.MACHIAZA.num}
      //       ) as coordinate_level
      //     FROM
      //       ${DbTableName.TOWN}
      //     WHERE
      //       (
      //         ${DataField.OAZA_CHO.dbColumn} != '' AND
      //         ${DataField.OAZA_CHO.dbColumn} IS NOT NULL
      //       ) AND (
      //         ${DataField.CHOME.dbColumn} = '' OR
      //         ${DataField.CHOME.dbColumn} IS NULL
      //       ) AND (
      //         ${DataField.KOAZA.dbColumn} = '' OR
      //         ${DataField.KOAZA.dbColumn} IS NULL
      //       )
      //   )
      //   UPDATE resultTable
      //   SET
      //     rep_lat = other.rep_lat,
      //     rep_lon = other.rep_lon,
      //     coordinate_level = other.coordinate_level
      //   FROM other
      //   WHERE
      //     resultTable.rep_lat IS NULL
      //     AND
      //     resultTable.pkey like concat(other.pkey, '%')
      // `);

      this.exec('COMMIT');

      //--------------------------------------
      // 大字・丁目で丁目が緯度経度を持っていないが
      // 大字が持っている場合がある。
      // この場合、大字の緯度経度を丁目に適用する
      //--------------------------------------
      type OtherRow = {
        pkey: string;
        rep_lat: string;
        rep_lon: string;
        coordinate_level: number;
      };
      const otherRows = this.prepare<unknown[], OtherRow>(`
        SELECT
            (city_key || ${DataField.OAZA_CHO.dbColumn}) as pkey,
            ${DataField.REP_LAT.dbColumn} as rep_lat,
            ${DataField.REP_LON.dbColumn} as rep_lon,
            IIF(
              ${DataField.REP_LAT.dbColumn} = '' OR ${DataField.REP_LAT.dbColumn} IS NULL,
              ${MatchLevel.UNKNOWN.num},
              ${MatchLevel.MACHIAZA.num}
            ) as coordinate_level
          FROM
            ${DbTableName.TOWN}
          WHERE
            (
              ${DataField.OAZA_CHO.dbColumn} != '' AND
              ${DataField.OAZA_CHO.dbColumn} IS NOT NULL
            ) AND (
              ${DataField.CHOME.dbColumn} = '' OR
              ${DataField.CHOME.dbColumn} IS NULL
            ) AND (
              ${DataField.KOAZA.dbColumn} = '' OR
              ${DataField.KOAZA.dbColumn} IS NULL
            )
        `).all();
      const memo = new TrieAddressFinder<OtherRow>();
      otherRows.forEach(row => {
        memo.append({
          key: row.pkey,
          value: row,
        });
      });

      let townRows = this.prepare<unknown[], TownRow>('SELECT * FROM resultTable').all();
      townRows = townRows.map(row => {
        if (row.rep_lat && row.rep_lon) {
          return row;
        }
        
        const results = memo.find({
          target: CharNode.create(row.pkey)!,
          fuzzy: undefined,
        });
        if (results && results.length > 0) {
          // coordinate_level が一番高い値を採用
          results.sort((a, b) => b.info!.coordinate_level - a.info!.coordinate_level);

          row.coordinate_level = results[0].info!.coordinate_level;
          if (results[0].info!.rep_lat && results[0].info!.rep_lon) {
            row.rep_lat = results[0].info!.rep_lat;
            row.rep_lon = results[0].info!.rep_lon;
          }
        }
        return row;
      });


      this.exec('DROP TABLE resultTable');
      
      resolve(townRows);
    });

    const rows: OazaChoMachingInfo[] = townRows.map(townRow => {
      const key = [
        townRow.oaza_cho || '',
        townRow.chome || '',
        townRow.koaza || '',
      ].join('');
      
      const city = cityMap.get(townRow.city_key)!;
      const pref = prefMap.get(city.pref_key)!;

      let coordinate_level = MatchLevel.from(townRow.coordinate_level);
      if (coordinate_level.num === MatchLevel.UNKNOWN.num) {
        townRow.rep_lat = city.rep_lat;
        townRow.rep_lon = city.rep_lon;
        coordinate_level = MatchLevel.CITY;
      }

      return {
        key,
        pref: pref.pref,
        city: city.city,
        county: city.county,
        ward: city.ward,
        chome: townRow.chome,
        lg_code: city.lg_code,
        oaza_cho: townRow.oaza_cho,
        machiaza_id: townRow.machiaza_id,
        pref_key: city.pref_key,
        city_key: townRow.city_key,
        koaza: townRow.koaza,
        town_key: townRow.town_key,
        rsdt_addr_flg: townRow.rsdt_addr_flg,
        match_level: MatchLevel.from(townRow.match_level),
        rep_lat: townRow.rep_lat,
        rep_lon: townRow.rep_lon,
        coordinate_level,
      };
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
      };
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
          t.${DataField.KOAZA_AKA_CODE.dbColumn} != 2 AND
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
  }

  // -----------------------------------------
  // 〇〇区△△ のHashMapを返す（△△は大字）
  // -----------------------------------------
  getWardAndOazaChoList(): Promise<WardAndOazaMatchingInfo[]> {
    type WardAndOazaRow = {
      key: string;
      match_level: number;
      coordinate_level: number;
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

      this.exec('BEGIN TRANSACTION');

      this.exec(`
        CREATE TEMP TABLE WardAndOazaChoTmpTable (
          pkey TEXT PRIMARY KEY,
          key TEXT,
          pref_key INTEGER,
          city_key INTEGER,
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
      `);

      this.exec(`
        INSERT INTO WardAndOazaChoTmpTable
        SELECT
          (
            c.city_key ||
            (substr(t.${DataField.MACHIAZA_ID.dbColumn}, 1, 4) || '000')
          ) as pkey,
          (
            c.${DataField.WARD.dbColumn} ||
            t.${DataField.OAZA_CHO.dbColumn}
          ) as key,
          p.pref_key,
          c.city_key,
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
      `);
      
      this.exec(`
        REPLACE INTO WardAndOazaChoTmpTable
        SELECT
          (
            c.city_key ||
            t.${DataField.MACHIAZA_ID.dbColumn}
          ) as pkey,
          (
            c.${DataField.WARD.dbColumn} ||
            t.${DataField.OAZA_CHO.dbColumn}
          ) as key,
          p.pref_key,
          c.city_key,
          p.${DataField.PREF.dbColumn} as pref,
          c.${DataField.COUNTY.dbColumn} as county,
          c.${DataField.CITY.dbColumn} as city,
          c.${DataField.WARD.dbColumn} as ward,
          c.${DataField.LG_CODE.dbColumn} as lg_code,
          t.${DataField.OAZA_CHO.dbColumn} as oaza_cho,
          t.${DataField.MACHIAZA_ID.dbColumn} AS machiaza_id,
          t.${DataField.RSDT_ADDR_FLG.dbColumn} as rsdt_addr_flg,

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
      `);
      const rows = this.prepare<unknown[], WardAndOazaRow>(`
        SELECT * FROM WardAndOazaChoTmpTable
      `).all();
      
      this.exec('DROP TABLE WardAndOazaChoTmpTable');
      
      resolve(rows);
    })
      .then((rows: WardAndOazaRow[]) => {
        const results: WardAndOazaMatchingInfo[] = rows.map(row => {
          return {
            ...row,
            match_level: MatchLevel.MACHIAZA,
            coordinate_level: row.coordinate_level === MatchLevel.CITY.num ? MatchLevel.CITY : MatchLevel.MACHIAZA,
          };
        });

        return Promise.resolve(results);
      });
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
  }

  async getWards(): Promise<WardMatchingInfo[]> {
    type WardRow = Omit<WardMatchingInfo, 'coordinate_level'>;
    
    const results = this.prepare<unknown[], WardRow>(`
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

    `).all();
    
    return results.map(row => {
      return {
        ...row,
        match_level: MatchLevel.CITY,
        coordinate_level: MatchLevel.CITY,
      };
    });
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
