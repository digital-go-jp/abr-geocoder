import { DatasetFileParams, IDatasetFileMeta } from '@domain/dataset-file';
import { DataField } from '@domain/dataset/data-field';
import { IStreamReady } from '@domain/istream-ready';
import { DataWithDateFile } from './dataset-file';

export class CityDatasetFile
  extends DataWithDateFile
  implements IDatasetFileMeta
{
  get fields(): DataField[] {
    return [
      DataField.LG_CODE,
      DataField.PREF_NAME,
      DataField.PREF_NAME_KANA,
      DataField.PREF_NAME_ROMA,
      DataField.COUNTY_NAME,
      DataField.COUNTY_NAME_KANA,
      DataField.COUNTY_NAME_ROMA,
      DataField.CITY_NAME,
      DataField.CITY_NAME_KANA,
      DataField.CITY_NAME_ROMA,
      DataField.OD_CITY_NAME,
      DataField.OD_CITY_NAME_KANA,
      DataField.OD_CITY_NAME_ROMA,
      DataField.EFCT_DATE,
      DataField.ABLT_DATE,
      DataField.REMARKS,
    ];
  }

  constructor(params: DatasetFileParams) {
    super(params);
    Object.freeze(this);
  }

  static create(
    params: IDatasetFileMeta,
    csvFile: IStreamReady
  ): CityDatasetFile {
    const sql = `INSERT OR REPLACE INTO "city"
      (
        ${DataField.LG_CODE.dbColumn},
        ${DataField.PREF_NAME.dbColumn},
        ${DataField.PREF_NAME_KANA.dbColumn},
        ${DataField.PREF_NAME_ROMA.dbColumn},
        ${DataField.COUNTY_NAME.dbColumn},
        ${DataField.COUNTY_NAME_KANA.dbColumn},
        ${DataField.COUNTY_NAME_ROMA.dbColumn},
        ${DataField.CITY_NAME.dbColumn},
        ${DataField.CITY_NAME_KANA.dbColumn},
        ${DataField.CITY_NAME_ROMA.dbColumn},
        ${DataField.OD_CITY_NAME.dbColumn},
        ${DataField.OD_CITY_NAME_KANA.dbColumn},
        ${DataField.OD_CITY_NAME_ROMA.dbColumn},
        ${DataField.EFCT_DATE.dbColumn},
        ${DataField.ABLT_DATE.dbColumn},
        ${DataField.REMARKS.dbColumn}
      )
      VALUES
      (
        @${DataField.LG_CODE.dbColumn},
        @${DataField.PREF_NAME.dbColumn},
        @${DataField.PREF_NAME_KANA.dbColumn},
        @${DataField.PREF_NAME_ROMA.dbColumn},
        @${DataField.COUNTY_NAME.dbColumn},
        @${DataField.COUNTY_NAME_KANA.dbColumn},
        @${DataField.COUNTY_NAME_ROMA.dbColumn},
        @${DataField.CITY_NAME.dbColumn},
        @${DataField.CITY_NAME_KANA.dbColumn},
        @${DataField.CITY_NAME_ROMA.dbColumn},
        @${DataField.OD_CITY_NAME.dbColumn},
        @${DataField.OD_CITY_NAME_KANA.dbColumn},
        @${DataField.OD_CITY_NAME_ROMA.dbColumn},
        @${DataField.EFCT_DATE.dbColumn},
        @${DataField.ABLT_DATE.dbColumn},
        @${DataField.REMARKS.dbColumn}
      )
      `;
    return new CityDatasetFile({
      ...params,
      sql,
      csvFile,
    });
  }
}
