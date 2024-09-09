/*!
 * MIT License
 *
 * Copyright (c) 2024 デジタル庁
 * Copyright (c) 2024 NEKOYASAN
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
import {D1Database} from "@cloudflare/workers-types";

export class RsdtBlkGeocodeD1 implements IRsdtBlkDbGeocode {

  private readonly d1Client: D1Database;

  constructor(d1Client: D1Database) {
    this.d1Client = d1Client;
  }


  async closeDb(): Promise<void> {
    // D1Database はクローズ不要
    // Do nothing here
  }

  async getBlockNumRows(where: Required<{
    town_key: number;
    blk_num: string; 
  }>): Promise<RsdtBlkInfo[]> {
    const stmt = this.d1Client.prepare(`
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
        town_key = ?1 AND
        ${DataField.BLK_NUM.dbColumn} LIKE ?2
    `).bind(where.town_key, where.blk_num);

    const {results} = await stmt.all<RsdtBlkInfo>();
    return results;
  }
}
