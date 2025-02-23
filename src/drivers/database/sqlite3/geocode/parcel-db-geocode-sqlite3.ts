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
import { ParcelInfo } from "@domain/types/geocode/parcel-info";
import { GetParcelRowsOptions, IParcelDbGeocode } from "../../common-db";
import { Sqlite3Wrapper } from "../better-sqlite3-wrap";
import crc32Lib from "@domain/services/crc32-lib";

export class ParcelDbGeocodeSqlite3 extends Sqlite3Wrapper implements IParcelDbGeocode {

  async close() {
    this.driver.close();
  }

  async hasTable(): Promise<boolean> {
    const rows = this.prepare<{ name: string; }, { name: string; }>(`
      SELECT
        name
      FROM
        sqlite_master
      WHERE
        type = 'table' AND
        name = @name
    `).all({
      name: DbTableName.PARCEL,
    });
    return rows.length === 1;
  }
  
  getParcelRowsGeneratorHash() : string {
    return crc32Lib.fromString(this.getParcelRows.toString());
  }
  
  async getParcelRows(where?: GetParcelRowsOptions): Promise<ParcelInfo[]> {
    return new Promise((resolve: (rows: ParcelInfo[]) => void) => {
      let sql = `
        SELECT
          parcel_key,
          IFNULL(town_key, 0) as town_key,
          ${DataField.PRC_ID.dbColumn} as prc_id,
          ${DataField.PRC_NUM1.dbColumn} as prc_num1,
          ${DataField.PRC_NUM2.dbColumn} as prc_num2,
          ${DataField.PRC_NUM3.dbColumn} as prc_num3,
          ${DataField.REP_LAT.dbColumn} as rep_lat,
          ${DataField.REP_LON.dbColumn} as rep_lon
        FROM
          ${DbTableName.PARCEL}
      `;
      if (where) {
        sql += `
        WHERE
          town_key = @town_key AND
          ${DataField.PRC_ID.dbColumn} LIKE @prc_id`;
      } else {
        where = {
          town_key: 0,
          prc_id: '', 
        };
      }

      const rows = this.prepare<GetParcelRowsOptions, ParcelInfo>(sql).all(where);
      resolve(rows);
    });
  }
}
