
import { DataField } from "@config/data-field";
import { DbTableName } from "@config/db-table-name";
import { RsdtDspInfo } from "@domain/types/geocode/rsdt-dsp-info";
import { IRsdtDspDbGeocode } from "../../common-db";
import { Sqlite3Wrapper } from "../better-sqlite3-wrap";

export class RsdtDspGeocodeSqlite3 extends Sqlite3Wrapper implements IRsdtDspDbGeocode {

  async closeDb(): Promise<void> {
    this.close();
  }

  async getRsdtDspRows(where: Required<{
    rsdtblk_key: number;
  }>): Promise<RsdtDspInfo[]> {
    return new Promise((resolve: (rows: RsdtDspInfo[]) => void) => {

      const rows = this.prepare<any, RsdtDspInfo>(`
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
          rsdtblk_key = @rsdtblk_key
      `).all(where);
      resolve(rows);
    });
  }
}