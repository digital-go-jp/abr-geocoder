import { IStreamReady } from '..';
import { DatasetFileParams, IDatasetFile, IDatasetFileMeta } from '../types';
import { DataField } from './DataField';
import { DataForPosFile } from './DatasetFile';

export class TownPosDatasetFile extends DataForPosFile implements IDatasetFile {
  get fields(): DataField[] {
    return [
      DataField.LG_CODE,
      DataField.REP_PNT_LAT,
      DataField.REP_PNT_LON,
      DataField.TOWN_ID,
    ];
  }

  constructor(params: DatasetFileParams) {
    super(params);
    Object.freeze(this);
  }

  static create(
    params: IDatasetFileMeta,
    csvFile: IStreamReady,
  ): TownPosDatasetFile {
    const sql = `UPDATE
        "town"
      SET
        ${DataField.REP_PNT_LON.dbColumn} = @${DataField.REP_PNT_LON.dbColumn},
        ${DataField.REP_PNT_LAT.dbColumn} = @${DataField.REP_PNT_LAT.dbColumn}
      WHERE
        ${DataField.LG_CODE.dbColumn} = @${DataField.LG_CODE.dbColumn}  AND
        ${DataField.TOWN_ID.dbColumn} = @${DataField.TOWN_ID.dbColumn} 
      `;
    return new TownPosDatasetFile({
      ...params,
      sql,
      csvFile,
    });
  }
}
