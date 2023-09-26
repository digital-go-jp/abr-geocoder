import { IStreamReady } from '..';
import { IDatasetFileMeta } from '../types';
import { DataField } from './DataField';
import { DataWithDateFile } from './DatasetFile';

export class PrefDatasetFile
  extends DataWithDateFile
  implements IDatasetFileMeta
{
  get fields(): DataField[] {
    return [
      DataField.LG_CODE,
      DataField.PREF_NAME,
      DataField.PREF_NAME_KANA,
      DataField.PREF_NAME_ROMA,
      DataField.EFCT_DATE,
      DataField.ABLT_DATE,
      DataField.REMARKS,
    ];
  }

  static create(
    params: IDatasetFileMeta,
    csvFile: IStreamReady
  ): PrefDatasetFile {
    const sql = `INSERT OR REPLACE INTO "pref"
      (
        ${DataField.LG_CODE.dbColumn},
        ${DataField.PREF_NAME.dbColumn},
        ${DataField.PREF_NAME_KANA.dbColumn},
        ${DataField.PREF_NAME_ROMA.dbColumn},
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
        @${DataField.EFCT_DATE.dbColumn},
        @${DataField.ABLT_DATE.dbColumn},
        @${DataField.REMARKS.dbColumn}
      )
      `;
    return new PrefDatasetFile({
      ...params,
      sql,
      csvFile,
    });
  }
}
