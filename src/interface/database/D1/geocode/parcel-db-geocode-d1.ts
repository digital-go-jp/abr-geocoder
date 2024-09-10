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
import { ParcelInfo } from "@domain/types/geocode/parcel-info";
import { IParcelDbGeocode } from "../../common-db";
import {D1Database} from "@cloudflare/workers-types";

export class ParcelDbGeocodeD1 implements IParcelDbGeocode {
  private readonly d1Client: D1Database;
  private readonly lg_code: string;

  constructor(d1Client: D1Database, lg_code: string) {
    this.d1Client = d1Client;
    this.lg_code = lg_code;
  }


  async closeDb(): Promise<void> {
    // D1Database はクローズ不要
    // Do nothing here
  }

  async getParcelRows(where: Required<{
    city_key: number;
    town_key?: number | null;
    prc_id: string;
  }>): Promise<ParcelInfo[]> {
    where.town_key = where.town_key || null;
    const stmt = this.d1Client.prepare(`
        SELECT
          parcel_key,
          ${DataField.PRC_ID.dbColumn} as prc_id,
          ${DataField.PRC_NUM1.dbColumn} as prc_num1,
          ${DataField.PRC_NUM2.dbColumn} as prc_num2,
          ${DataField.PRC_NUM3.dbColumn} as prc_num3,
          ${DataField.REP_LAT.dbColumn} as rep_lat,
          ${DataField.REP_LON.dbColumn} as rep_lon
        FROM
          ${DbTableName.PARCEL}_${this.lg_code}
        WHERE
          town_key = ?1 AND
          ${DataField.PRC_ID.dbColumn} LIKE ?2
      `).bind(where.town_key, where.prc_id);
    const {results} = await stmt.all<ParcelInfo>();
    return results;
  }
}
