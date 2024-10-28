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
import { IRsdtBlkDbDownload } from "@interface/database/common-db";
import { Sqlite3Wrapper } from "@interface/database/sqlite3/better-sqlite3-wrap";
import { Statement } from "better-sqlite3";

export class RsdtBlkDbDownloadSqlite3 extends Sqlite3Wrapper implements IRsdtBlkDbDownload {
  
  async createRsdtBlkTable() {
    this.exec(`
      CREATE TABLE IF NOT EXISTS "${DbTableName.RSDT_BLK}" (
        "rsdtblk_key" TEXT PRIMARY KEY,
        "town_key" TEXT,
        "${DataField.BLK_ID.dbColumn}" TEXT,
        "${DataField.BLK_NUM.dbColumn}" TEXT,
        "crc32" TEXT,

        "${DataField.REP_LAT.dbColumn}" TEXT,
        "${DataField.REP_LON.dbColumn}" TEXT
      );
    `);

    this.exec(`
      CREATE INDEX IF NOT EXISTS "idx_rsdt_blk_town_key_and_blk_num" ON "${DbTableName.RSDT_BLK}" (
        "town_key",
        "${DataField.BLK_NUM.dbColumn}"
      );
    `);
  }

  async closeDb(): Promise<void> {
    this.close();
  }

  // rep_lat, rep_lon を rsdt_blkテーブルに挿入/更新する
  async rsdtBlkPosCsvRows(rows: Record<string, string | number>[]): Promise<void> {
    const sql = `
      INSERT INTO ${DbTableName.RSDT_BLK} (
        rsdtblk_key,
        town_key,
        ${DataField.REP_LAT.dbColumn},
        ${DataField.REP_LON.dbColumn}
      ) VALUES (
        @rsdtblk_key,
        @town_key,
        @rep_lat,
        @rep_lon
      ) ON CONFLICT (rsdtblk_key) DO UPDATE SET
        ${DataField.REP_LAT.dbColumn} = @rep_lat,
        ${DataField.REP_LON.dbColumn} = @rep_lon
      WHERE 
        ${DataField.REP_LAT.dbColumn} != @rep_lat OR 
        ${DataField.REP_LON.dbColumn} != @rep_lon OR 
        ${DataField.REP_LAT.dbColumn} IS NULL OR
        ${DataField.REP_LON.dbColumn} IS NULL
    `;

    await this.createRsdtBlkTable();
    return await this.upsertRows({
      upsert: this.prepare(sql),
      rows,
    });
  }

  // テーブルにcsvのデータを溜め込む
  async rsdtBlkCsvRows(rows: Record<string, string | number>[]) {
    const sql = `
      INSERT INTO ${DbTableName.RSDT_BLK} (
        rsdtblk_key,
        town_key,
        ${DataField.BLK_ID.dbColumn},
        ${DataField.BLK_NUM.dbColumn},
        crc32
      ) VALUES (
        @rsdtblk_key,
        @town_key,
        @blk_id,
        @blk_num,
        @crc32
      ) ON CONFLICT (rsdtblk_key) DO UPDATE SET
        ${DataField.BLK_ID.dbColumn} = @blk_id,
        ${DataField.BLK_NUM.dbColumn} = @blk_num,
        crc32 = @crc32
      WHERE 
        crc32 != @crc32 OR
        crc32 IS NULL
    `;

    await this.createRsdtBlkTable();
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
          if (row.rsdt_addr_flg === 0) {
            continue;
          }
          row.town_key = TableKeyProvider.getTownKey({
            lg_code,
            machiaza_id: row[DataField.MACHIAZA_ID.dbColumn].toString(),
          })!;
          
          row.rsdtblk_key = TableKeyProvider.getRsdtBlkKey({
            lg_code: row[DataField.LG_CODE.dbColumn].toString(),
            machiaza_id: row[DataField.MACHIAZA_ID.dbColumn].toString(),
            blk_id: row[DataField.BLK_ID.dbColumn].toString(),
          });
          params.upsert.run(row);
        }
        resolve();
      })(params.rows);
    });
  }
}
