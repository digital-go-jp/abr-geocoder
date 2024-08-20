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
import { IRsdtDspDbDownload } from "@interface/database/common-db";
import { Sqlite3Wrapper } from "@interface/database/sqlite3/better-sqlite3-wrap";
import { Statement } from "better-sqlite3";

export class RsdtDspDownloadSqlite3 extends Sqlite3Wrapper implements IRsdtDspDbDownload {
  async closeDb(): Promise<void> {
    Promise.resolve(this.close());
  }

  // Lat,Lonを テーブルにcsvのデータを溜め込む
  async rsdtDspPosCsvRows(rows: Record<string, string | number>[]): Promise<void> {
    const sql = `
      INSERT INTO ${DbTableName.RSDT_DSP} (
        rsdtdsp_key,
        rsdtblk_key,
        ${DataField.REP_LAT.dbColumn},
        ${DataField.REP_LON.dbColumn}
      ) VALUES (
        @rsdtdsp_key,
        @rsdtblk_key,
        @rep_lat,
        @rep_lon
      ) ON CONFLICT (rsdtdsp_key) DO UPDATE SET
        ${DataField.REP_LAT.dbColumn} = @rep_lat,
        ${DataField.REP_LON.dbColumn} = @rep_lon
      WHERE 
        rsdtdsp_key = @rsdtdsp_key AND
        (${DataField.REP_LAT.dbColumn} != @rep_lat OR 
        ${DataField.REP_LON.dbColumn} != @rep_lon OR 
        ${DataField.REP_LAT.dbColumn} IS NULL OR
        ${DataField.REP_LON.dbColumn} IS NULL)
    `;
    
    
    return await this.upsertRows({
      upsert: this.prepare(sql),
      rows,
    });
  }

  // テーブルにcsvのデータを溜め込む
  async rsdtDspCsvRows(rows: Record<string, string | number>[]) {
    const sql = `
      INSERT INTO ${DbTableName.RSDT_DSP} (
        rsdtdsp_key,
        rsdtblk_key,
        ${DataField.RSDT_ID.dbColumn},
        ${DataField.RSDT2_ID.dbColumn},
        ${DataField.RSDT_NUM.dbColumn},
        ${DataField.RSDT_NUM2.dbColumn},
        ${DataField.RSDT_ADDR_FLG.dbColumn}
      ) VALUES (
        @rsdtdsp_key,
        @rsdtblk_key,
        @rsdt_id,
        @rsdt2_id,
        @rsdt_num,
        @rsdt_num2,
        @rsdt_addr_flg
      ) ON CONFLICT (rsdtdsp_key) DO UPDATE SET
        ${DataField.RSDT_ID.dbColumn} = @rsdt_id,
        ${DataField.RSDT2_ID.dbColumn} = @rsdt2_id,
        ${DataField.RSDT_NUM.dbColumn} = @rsdt_num,
        ${DataField.RSDT_NUM2.dbColumn} = @rsdt_num2,
        ${DataField.RSDT_ADDR_FLG.dbColumn} = @rsdt_addr_flg
      WHERE 
        rsdtdsp_key = @rsdtdsp_key
    `;
    
    return await this.upsertRows({
      upsert: this.prepare(sql),
      rows,
    });
  }

  private async upsertRows(params: Required<{
    upsert: Statement;
    rows: Record<string, string | number>[];
  }>) {
    return await new Promise((resolve: (_?: void) => void) => {

      this.transaction((rows: Record<string, string | number>[]) => {

        const lg_code = rows[0][DataField.LG_CODE.dbColumn].toString();

        for (const row of rows) {
          row.rsdtblk_key = TableKeyProvider.getRsdtBlkKey({
            lg_code,
            machiaza_id: row[DataField.MACHIAZA_ID.dbColumn].toString(),
            blk_id: row[DataField.BLK_ID.dbColumn].toString(),
          });
          row.rsdtdsp_key = TableKeyProvider.getRsdtDspKey({
            lg_code,
            machiaza_id: row[DataField.MACHIAZA_ID.dbColumn].toString(),
            blk_id: row[DataField.BLK_ID.dbColumn].toString(),
            rsdt_id: row[DataField.RSDT_ID.dbColumn].toString(),
            rsdt2_id: row[DataField.RSDT2_ID.dbColumn].toString(),
            rsdt_addr_flg: row[DataField.RSDT_ADDR_FLG.dbColumn] as number,
          });
          
          params.upsert.run(row);
        }
        resolve();
      })(params.rows);
    });
  }
}
