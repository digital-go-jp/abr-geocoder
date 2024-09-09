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
import { RsdtDspInfo } from "@domain/types/geocode/rsdt-dsp-info";
import { IRsdtDspDbGeocode } from "../../common-db";
import {D1Database} from "@cloudflare/workers-types";

export class RsdtDspGeocodeD1 implements IRsdtDspDbGeocode {
  private readonly d1Client: D1Database;

  constructor(d1Client: D1Database) {
    this.d1Client = d1Client;
  }


  async closeDb(): Promise<void> {
    // D1Database はクローズ不要
    // Do nothing here
  }

  async getRsdtDspRows(where: Required<{
    rsdtblk_key: number;
  }>): Promise<RsdtDspInfo[]> {
    const stmt = this.d1Client.prepare(`
        SELECT
          rsdtdsp_key,
          rsdtblk_key,
          ${DataField.RSDT_ID.dbColumn} AS rsdt_id,
          ${DataField.RSDT2_ID.dbColumn} AS rsdt2_id,
          CAST(${DataField.RSDT_ID.dbColumn} AS INTEGER) AS rsdt_num,

          IIF(
            -- if conditions are true,
            ${DataField.RSDT2_ID.dbColumn} IS NOT NULL AND
            ${DataField.RSDT2_ID.dbColumn} != '',

            -- then
            CAST(${DataField.RSDT2_ID.dbColumn} AS INTEGER),

            -- else
            NULL
          ) AS rsdt_num2,
          ${DataField.REP_LAT.dbColumn} as rep_lat,
          ${DataField.REP_LON.dbColumn} as rep_lon
        FROM
          ${DbTableName.RSDT_DSP}
        WHERE
          rsdtblk_key = ?1
      `).bind(where.rsdtblk_key);
    const { results } = await stmt.all<RsdtDspInfo>();
    return results;
  }
}
