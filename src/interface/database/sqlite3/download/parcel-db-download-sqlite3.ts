
import { DataField } from "@config/data-field";
import { DbTableName } from "@config/db-table-name";
import { TableKeyProvider } from "@domain/services/table-key-provider";
import { IParcelDbDownload } from "@interface/database/common-db";
import { Sqlite3Wrapper } from "@interface/database/sqlite3/better-sqlite3-wrap";
import { Statement } from "better-sqlite3";

export class ParcelDbDownloadSqlite3 extends Sqlite3Wrapper implements IParcelDbDownload {
  async closeDb(): Promise<void> {
    this.close();
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
        ${DataField.PRC_NUM3.dbColumn}
      ) VALUES (
        @parcel_key,
        @town_key,
        @prc_id,
        @prc_num1,
        @prc_num2,
        @prc_num3
      ) ON CONFLICT (parcel_key) DO UPDATE SET
        ${DataField.PRC_ID.dbColumn} = @prc_id,
        ${DataField.PRC_NUM1.dbColumn} = @prc_num1,
        ${DataField.PRC_NUM2.dbColumn} = @prc_num2,
        ${DataField.PRC_NUM3.dbColumn} = @prc_num3
      WHERE 
        parcel_key = @parcel_key
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
        const lg_code = rows[0][DataField.LG_CODE.dbColumn] as string;

        for (const row of rows) {
          row.town_key = TableKeyProvider.getTownKey({
            lg_code,
            machiaza_id: row[DataField.MACHIAZA_ID.dbColumn] as string,
          });
          row.parcel_key = TableKeyProvider.getParcelKey({
            lg_code: row[DataField.LG_CODE.dbColumn],
            machiaza_id: row[DataField.MACHIAZA_ID.dbColumn],
            prc_id: row[DataField.PRC_ID.dbColumn],
          });
          params.upsert.run(row);
        }
        resolve();
      })(params.rows);
    })
  }
}