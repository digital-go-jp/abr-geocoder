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
import { IParcelDbDownload } from "@interface/database/common-db";
import { Sqlite3Wrapper } from "@interface/database/sqlite3/better-sqlite3-wrap";
import { Statement } from "better-sqlite3";

export class ParcelDbDownloadSqlite3 extends Sqlite3Wrapper implements IParcelDbDownload {
  
  async createParcelTable() {
    this.exec(`
      CREATE TABLE IF NOT EXISTS "${DbTableName.PARCEL}" (
        "parcel_key" INTEGER PRIMARY KEY,
        "town_key" INTEGER DEFAULT null,
        "${DataField.PRC_ID.dbColumn}" TEXT,
        "${DataField.PRC_NUM1.dbColumn}" TEXT,
        "${DataField.PRC_NUM2.dbColumn}" TEXT,
        "${DataField.PRC_NUM3.dbColumn}" TEXT,
        "crc32" TEXT,
        "${DataField.REP_LAT.dbColumn}" TEXT,
        "${DataField.REP_LON.dbColumn}" TEXT
      );
    `);

    this.exec(`
      CREATE INDEX IF NOT EXISTS idx_parcel_town_key ON ${DbTableName.PARCEL}(town_key, ${DataField.PRC_ID.dbColumn});
    `);
  }

  // Lat,Lonを テーブルにcsvのデータを溜め込む
  async parcelPosCsvRows(rows: Record<string, string | number>[]): Promise<void> {
    const sql = `
      INSERT INTO ${DbTableName.PARCEL} (
        parcel_key,
        town_key,
        ${DataField.REP_LAT.dbColumn},
        ${DataField.REP_LON.dbColumn}
      ) VALUES (
        @parcel_key,
        @town_key,
        @rep_lat,
        @rep_lon
      ) ON CONFLICT (parcel_key) DO UPDATE SET
        ${DataField.REP_LAT.dbColumn} = @rep_lat,
        ${DataField.REP_LON.dbColumn} = @rep_lon
      WHERE 
        parcel_key = @parcel_key AND (
          ${DataField.REP_LAT.dbColumn} != @rep_lat OR 
          ${DataField.REP_LON.dbColumn} != @rep_lon OR 
          ${DataField.REP_LAT.dbColumn} IS NULL OR
          ${DataField.REP_LON.dbColumn} IS NULL
        )
    `;
    
    await this.createParcelTable();
    
    return await this.upsertRows({
      upsert: this.prepare(sql),
      rows,
    });
  }

  // テーブルにcsvのデータを溜め込む
  async parcelCsvRows(rows: Record<string, string | number>[]) {
    const sql = `
      INSERT INTO ${DbTableName.PARCEL} (
        parcel_key,
        town_key,
        ${DataField.PRC_ID.dbColumn},
        ${DataField.PRC_NUM1.dbColumn},
        ${DataField.PRC_NUM2.dbColumn},
        ${DataField.PRC_NUM3.dbColumn},
        crc32
      ) VALUES (
        @parcel_key,
        @town_key,
        @prc_id,
        @prc_num1,
        @prc_num2,
        @prc_num3,
        @crc32
      ) ON CONFLICT (parcel_key) DO UPDATE SET
        ${DataField.PRC_ID.dbColumn} = @prc_id,
        ${DataField.PRC_NUM1.dbColumn} = @prc_num1,
        ${DataField.PRC_NUM2.dbColumn} = @prc_num2,
        ${DataField.PRC_NUM3.dbColumn} = @prc_num3,
        crc32 = @crc32
      WHERE 
        crc32 != @crc32 OR
        crc32 IS NULL
    `;

    await this.createParcelTable();
    
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
        const lg_code = rows[0][DataField.LG_CODE.dbColumn] as string;

        for (const row of rows) {
          row.town_key = TableKeyProvider.getTownKey({
            lg_code,
            machiaza_id: row[DataField.MACHIAZA_ID.dbColumn].toString(),
          });
          row.parcel_key = TableKeyProvider.getParcelKey({
            lg_code: row[DataField.LG_CODE.dbColumn].toString().toString(),
            machiaza_id: row[DataField.MACHIAZA_ID.dbColumn].toString(),
            prc_id: row[DataField.PRC_ID.dbColumn].toString(),
          });
          params.upsert.run(row);
        }
        resolve();
      })(params.rows);
    });
  }
}
