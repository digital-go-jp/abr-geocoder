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
import { DataField } from "@config/data-field";
import { DbTableName } from "@config/db-table-name";
import { TableKeyProvider } from "@domain/services/table-key-provider";
import { ICommonDbDownload } from "@interface/database/common-db";
import { Sqlite3Wrapper } from "@interface/database/sqlite3/better-sqlite3-wrap";
import { Statement } from "better-sqlite3";
export class CommonDbDownloadSqlite3 
  extends Sqlite3Wrapper
  implements ICommonDbDownload {

  async closeDb(): Promise<void> {
    this.close();
  }

  // Prefテーブルにデータを挿入する
  async prefCsvRows(rows: Record<string, string | number>[]) {
    const sql = `
      INSERT INTO ${DbTableName.PREF} (
        pref_key,
        ${DataField.LG_CODE.dbColumn},
        ${DataField.PREF.dbColumn}
      ) VALUES (
        @pref_key,
        @lg_code,
        @pref
      ) ON CONFLICT (pref_key) DO UPDATE SET
        ${DataField.LG_CODE.dbColumn} = @lg_code,
        ${DataField.PREF.dbColumn} = @pref
      WHERE 
        pref_key = @pref_key
    `;

    return await this.upsertRowsForPref({
      upsert: this.prepare(sql),
      rows,
    });
  }

  // rep_lat, rep_lon を Prefテーブルに挿入/更新する
  async prefPosCsvRows(rows: Record<string, string | number>[]): Promise<void> {
    const sql = `
      INSERT INTO ${DbTableName.PREF} (
        pref_key,
        ${DataField.REP_LAT.dbColumn},
        ${DataField.REP_LON.dbColumn}
      ) VALUES (
        @pref_key,
        @rep_lat,
        @rep_lon
      ) ON CONFLICT (pref_key) DO UPDATE SET
        ${DataField.REP_LAT.dbColumn} = @rep_lat,
        ${DataField.REP_LON.dbColumn} = @rep_lon
      WHERE 
        pref_key = @pref_key AND (
          ${DataField.REP_LAT.dbColumn} != @rep_lat OR 
          ${DataField.REP_LON.dbColumn} != @rep_lon OR 
          ${DataField.REP_LAT.dbColumn} IS NULL OR
          ${DataField.REP_LON.dbColumn} IS NULL
        )
    `;
    return await this.upsertRowsForPref({
      upsert: this.prepare(sql),
      rows,
    });
  }

  private async upsertRowsForPref(params: Required<{
    upsert: Statement;
    rows: Record<string, string | number>[];
  }>) {
    return await new Promise((resolve: (_?: void) => void) => {
      this.transaction((rows) => {
        for (const row of rows) {
          row.pref_key = TableKeyProvider.getPrefKey({
            lg_code: row[DataField.LG_CODE.dbColumn],
          });
          params.upsert.run(row);
        }
        resolve();
      })(params.rows);
    })
  }

  // Cityテーブルにデータを挿入する
  async cityCsvRows(rows: Record<string, string | number>[]) {
    const sql = `
      INSERT INTO ${DbTableName.CITY} (
        city_key,
        pref_key,
        ${DataField.LG_CODE.dbColumn},
        ${DataField.COUNTY.dbColumn},
        ${DataField.CITY.dbColumn},
        ${DataField.WARD.dbColumn}
      ) VALUES (
        @city_key,
        @pref_key,
        @lg_code,
        @county,
        @city,
        @ward
      ) ON CONFLICT (city_key) DO UPDATE SET
        ${DataField.LG_CODE.dbColumn} = @lg_code,
        ${DataField.COUNTY.dbColumn} = @county,
        ${DataField.CITY.dbColumn} = @city,
        ${DataField.WARD.dbColumn} = @ward
      WHERE 
        city_key = @city_key
    `;

    const prefKey = TableKeyProvider.getPrefKey({
      lg_code: rows[0][DataField.LG_CODE.dbColumn].toString(),
    });
    return await this.upsertRowsForCity({
      prefKey,
      upsert: this.prepare(sql),
      rows,
    });
  }

  // rep_lat, rep_lon を Cityテーブルに挿入/更新する
  async cityPosCsvRows(rows: Record<string, string | number>[]): Promise<void> {
    const sql = `
      INSERT INTO ${DbTableName.CITY} (
        city_key,
        pref_key,
        ${DataField.REP_LAT.dbColumn},
        ${DataField.REP_LON.dbColumn}
      ) VALUES (
        @city_key,
        @pref_key,
        @rep_lat,
        @rep_lon
      ) ON CONFLICT (city_key) DO UPDATE SET
        ${DataField.REP_LAT.dbColumn} = @rep_lat,
        ${DataField.REP_LON.dbColumn} = @rep_lon
      WHERE 
        city_key = @city_key AND (
          ${DataField.REP_LAT.dbColumn} != @rep_lat OR 
          ${DataField.REP_LON.dbColumn} != @rep_lon OR 
          ${DataField.REP_LAT.dbColumn} IS NULL OR
          ${DataField.REP_LON.dbColumn} IS NULL
        )
    `;

    const prefKey = TableKeyProvider.getPrefKey({
      lg_code: rows[0][DataField.LG_CODE.dbColumn].toString(),
    });
    return await this.upsertRowsForCity({
      prefKey,
      upsert: this.prepare(sql),
      rows,
    });
  }

  private async upsertRowsForCity(params: Required<{
    upsert: Statement;
    prefKey: number;
    rows: Record<string, string | number>[];
  }>) {
    return await new Promise((resolve: (_?: void) => void) => {
      this.transaction((rows) => {
        for (const row of rows) {
          row.pref_key = params.prefKey;
          row.city_key = TableKeyProvider.getCityKey({
            lg_code: row[DataField.LG_CODE.dbColumn],
          });
          params.upsert.run(row);
        }
        resolve();
      })(params.rows);
    })
  }

  // Townテーブルにデータを挿入する
  async townCsvRows(rows: Record<string, string | number>[]) {
    const sql = `
      INSERT INTO ${DbTableName.TOWN} (
        town_key,
        city_key,
        ${DataField.MACHIAZA_ID.dbColumn},
        ${DataField.OAZA_CHO.dbColumn},
        ${DataField.CHOME.dbColumn},
        ${DataField.KOAZA.dbColumn},
        ${DataField.RSDT_ADDR_FLG.dbColumn}
      ) VALUES (
        @town_key,
        @city_key,
        @machiaza_id,
        @oaza_cho,
        @chome,
        @koaza,
        @rsdt_addr_flg
      ) ON CONFLICT (town_key) DO UPDATE SET
        ${DataField.MACHIAZA_ID.dbColumn} = @machiaza_id,
        ${DataField.OAZA_CHO.dbColumn} = @oaza_cho,
        ${DataField.CHOME.dbColumn} = @chome,
        ${DataField.KOAZA.dbColumn} = @koaza,
        ${DataField.RSDT_ADDR_FLG.dbColumn} = @rsdt_addr_flg
      WHERE 
        town_key = @town_key
    `;
    const cityKey = TableKeyProvider.getCityKey({
      lg_code: rows[0][DataField.LG_CODE.dbColumn].toString(),
    });
    return await this.upsertRowsForTown({
      cityKey,
      upsert: this.prepare(sql),
      rows,
    });
  }

  // rep_lat, rep_lon を Townテーブルに挿入/更新する
  async townPosCsvRows(rows: Record<string, string | number>[]): Promise<void> {
    const sql = `
      INSERT INTO ${DbTableName.TOWN} (
        town_key,
        city_key,
        ${DataField.REP_LAT.dbColumn},
        ${DataField.REP_LON.dbColumn}
      ) VALUES (
        @town_key,
        @city_key,
        @rep_lat,
        @rep_lon
      ) ON CONFLICT (town_key) DO UPDATE SET
        ${DataField.REP_LAT.dbColumn} = @rep_lat,
        ${DataField.REP_LON.dbColumn} = @rep_lon
      WHERE 
        town_key = @town_key AND (
          ${DataField.REP_LAT.dbColumn} != @rep_lat OR 
          ${DataField.REP_LON.dbColumn} != @rep_lon OR 
          ${DataField.REP_LAT.dbColumn} IS NULL OR
          ${DataField.REP_LON.dbColumn} IS NULL
        )
    `;
    const cityKey = TableKeyProvider.getCityKey({
      lg_code: rows[0][DataField.LG_CODE.dbColumn].toString(),
    });
    return await this.upsertRowsForTown({
      cityKey,
      upsert: this.prepare(sql),
      rows,
    });
  }

  private async upsertRowsForTown(params: Required<{
    upsert: Statement;
    cityKey: number;
    rows: Record<string, string | number>[];
  }>) {
    return await new Promise((resolve: (_?: void) => void) => {
      this.transaction((rows) => {
        for (const row of rows) {
          row.city_key = params.cityKey;
          row.town_key = TableKeyProvider.getTownKey({
            lg_code: row[DataField.LG_CODE.dbColumn],
            machiaza_id: row[DataField.MACHIAZA_ID.dbColumn],
          });
          params.upsert.run(row);
        }
        resolve();
      })(params.rows);
    })
  }
}