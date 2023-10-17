import {
  DatasetFileParams,
  IDatasetFile,
  IDatasetFileMeta,
  IStreamReady,
} from '@domain';
import { DataField } from './data-field';
import { DataForPosFile } from './dataset-file';

export class RsdtdspBlkPosFile extends DataForPosFile implements IDatasetFile {
  get fields(): DataField[] {
    return [
      DataField.LG_CODE,
      DataField.REP_PNT_LON,
      DataField.REP_PNT_LAT,
      DataField.TOWN_ID,
      DataField.BLK_ID,
    ];
  }

  constructor(params: DatasetFileParams) {
    super(params);
    Object.freeze(this);
  }

  static create(
    params: IDatasetFileMeta,
    csvFile: IStreamReady
  ): RsdtdspBlkPosFile {
    const sql = `UPDATE
        "rsdtdsp_blk"
      SET
        ${DataField.REP_PNT_LON.dbColumn} = @${DataField.REP_PNT_LON.dbColumn},
        ${DataField.REP_PNT_LAT.dbColumn} = @${DataField.REP_PNT_LAT.dbColumn}
      WHERE
        ${DataField.LG_CODE.dbColumn} = @${DataField.LG_CODE.dbColumn} AND
        ${DataField.TOWN_ID.dbColumn} = @${DataField.TOWN_ID.dbColumn} AND
        ${DataField.BLK_ID.dbColumn} = @${DataField.BLK_ID.dbColumn}
      `;
    return new RsdtdspBlkPosFile({
      ...params,
      sql,
      csvFile,
    });
  }
}
