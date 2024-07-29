
import { DataField } from "@config/data-field";
import { DbTableName } from "@config/db-table-name";
import { TableKeyProvider } from "@domain/services/table-key-provider";
import { IRsdtBlkDbDownload } from "@interface/database/common-db";
import { Sqlite3Wrapper } from "@interface/database/sqlite3/better-sqlite3-wrap";
import { Statement } from "better-sqlite3";

export class RsdtBlkDbDownloadSqlite3 extends Sqlite3Wrapper implements IRsdtBlkDbDownload {
  
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
        rsdtblk_key = @rsdtblk_key AND (
          ${DataField.REP_LAT.dbColumn} != @rep_lat OR 
          ${DataField.REP_LON.dbColumn} != @rep_lon OR 
          ${DataField.REP_LAT.dbColumn} IS NULL OR
          ${DataField.REP_LON.dbColumn} IS NULL
        )
    `;

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
        ${DataField.BLK_NUM.dbColumn}
      ) VALUES (
        @rsdtblk_key,
        @town_key,
        @blk_id,
        @blk_num
      ) ON CONFLICT (rsdtblk_key) DO UPDATE SET
        ${DataField.BLK_ID.dbColumn} = @blk_id,
        ${DataField.BLK_NUM.dbColumn} = @blk_num
      WHERE 
        rsdtblk_key = @rsdtblk_key
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
      this.transaction((rows) => {
        const lg_code = rows[0][DataField.LG_CODE.dbColumn].toString();

        for (const row of rows) {
          row.town_key = TableKeyProvider.getTownKey({
            lg_code,
            machiaza_id: row[DataField.MACHIAZA_ID.dbColumn].toString(),
          })!;
          
          row.rsdtblk_key = TableKeyProvider.getRsdtBlkKey({
            lg_code: row[DataField.LG_CODE.dbColumn],
            machiaza_id: row[DataField.MACHIAZA_ID.dbColumn],
            blk_id: row[DataField.BLK_ID.dbColumn],
          })
          params.upsert.run(row);
        }
        resolve();
      })(params.rows);
    })
  }
}