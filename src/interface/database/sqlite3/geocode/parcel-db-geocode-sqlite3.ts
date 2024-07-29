
import { DataField } from "@config/data-field";
import { DbTableName } from "@config/db-table-name";
import { ParcelInfo } from "@domain/types/geocode/parcel-info";
import { IParcelDbGeocode } from "../../common-db";
import { Sqlite3Wrapper } from "../better-sqlite3-wrap";

export class ParcelDbGeocodeSqlite3 extends Sqlite3Wrapper implements IParcelDbGeocode {

  async closeDb(): Promise<void> {
    this.close();
  }

  async getParcelRows(where: Required<{
    city_key: number;
    town_key?: number | null;
    prc_id: string; 
  }>): Promise<ParcelInfo[]> {
    where.town_key = where.town_key || null;
    return new Promise((resolve: (rows: ParcelInfo[]) => void) => {
      const rows = this.prepare<any, ParcelInfo>(`
        SELECT
          parcel_key,
          ${DataField.PRC_ID.dbColumn} as prc_id,
          ${DataField.PRC_NUM1.dbColumn} as prc_num1,
          ${DataField.PRC_NUM2.dbColumn} as prc_num2,
          ${DataField.PRC_NUM3.dbColumn} as prc_num3,
          ${DataField.REP_LAT.dbColumn} as rep_lat,
          ${DataField.REP_LON.dbColumn} as rep_lon
        FROM
          ${DbTableName.PARCEL}
        WHERE
          town_key = @town_key AND
          ${DataField.PRC_ID.dbColumn} LIKE @prc_id
      `).all(where);
      resolve(rows);
    });
  }
}