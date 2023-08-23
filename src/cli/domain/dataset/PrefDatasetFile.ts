import { DataWithDateFile } from './DatasetFile';
import {
  DatasetWithDateParams,
  IDatasetWithDateParams,
  IDatasetFileMeta,
} from './types';
import { DataField } from "./DataField";

export class PrefDatasetFile extends DataWithDateFile implements IDatasetWithDateParams {
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

  constructor(params: DatasetWithDateParams) {
    super(params)
    Object.freeze(this);
  }

  static create(params: IDatasetFileMeta, inputStream: NodeJS.ReadableStream): PrefDatasetFile {
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
      indexCols: 1,
      validDateCol: 4,
      sql,
      inputStream,
    });
  }
}