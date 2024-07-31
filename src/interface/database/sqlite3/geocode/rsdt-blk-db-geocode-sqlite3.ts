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
import { RsdtBlkInfo } from "@domain/types/geocode/rsdt-blk-info";
import { IRsdtBlkDbGeocode } from "../../common-db";
import { Sqlite3Wrapper } from "../better-sqlite3-wrap";

export class RsdtBlkGeocodeSqlite3 extends Sqlite3Wrapper implements IRsdtBlkDbGeocode {

  async closeDb(): Promise<void> {
    this.close();
  }

  async getBlockNumRows(where: Required<{
    town_key: number;
    blk_num: string; 
  }>): Promise<RsdtBlkInfo[]> {
    return new Promise((resolve: (rows: RsdtBlkInfo[]) => void) => {
      const rows = this.prepare<any, RsdtBlkInfo>(`
        SELECT
          rsdtblk_key,
          town_key,
          ${DataField.BLK_ID.dbColumn} AS blk_id,
          ${DataField.BLK_NUM.dbColumn} AS blk_num,
          ${DataField.REP_LAT.dbColumn} as rep_lat,
          ${DataField.REP_LON.dbColumn} as rep_lon
        FROM
          ${DbTableName.RSDT_BLK}
        WHERE
          town_key = @town_key AND
          ${DataField.BLK_NUM.dbColumn} LIKE @blk_num
      `).all(where);

      resolve(rows);
    });
  }
}