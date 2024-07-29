
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
          blk_id,
          CAST(${DataField.BLK_ID.dbColumn} AS INTEGER) AS blk_num,
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