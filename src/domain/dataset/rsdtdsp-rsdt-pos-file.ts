import {
  DatasetFileParams,
  IDatasetFile,
  IDatasetFileMeta,
  IStreamReady,
} from '@domain';
import { DataField } from './data-field';
import { DataForPosFile } from './dataset-file';

export class RsdtdspRsdtPosFile extends DataForPosFile implements IDatasetFile {
  get fields(): DataField[] {
    return [
      DataField.LG_CODE,
      DataField.REP_PNT_LAT,
      DataField.REP_PNT_LON,
      DataField.TOWN_ID,
      DataField.BLK_ID,
      DataField.ADDR_ID,
      DataField.ADDR2_ID,
    ];
  }

  constructor(params: DatasetFileParams) {
    super(params);
    Object.freeze(this);
  }

  static create(
    params: IDatasetFileMeta,
    csvFile: IStreamReady
  ): RsdtdspRsdtPosFile {
    const sql = `UPDATE
        "rsdtdsp_rsdt"
      SET
        ${DataField.REP_PNT_LON.dbColumn} = @${DataField.REP_PNT_LON.dbColumn},
        ${DataField.REP_PNT_LAT.dbColumn} = @${DataField.REP_PNT_LAT.dbColumn}
      WHERE
        ${DataField.LG_CODE.dbColumn} = @${DataField.LG_CODE.dbColumn} AND
        ${DataField.TOWN_ID.dbColumn}  = @${DataField.TOWN_ID.dbColumn} AND
        ${DataField.BLK_ID.dbColumn}  = @${DataField.BLK_ID.dbColumn} AND
        ${DataField.ADDR_ID.dbColumn}  = @${DataField.ADDR_ID.dbColumn} AND
        ${DataField.ADDR2_ID.dbColumn}  = @${DataField.ADDR2_ID.dbColumn}
      `;
    return new RsdtdspRsdtPosFile({
      ...params,
      sql,
      csvFile,
    });
  }
}
