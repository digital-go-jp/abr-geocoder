import { DataField } from './DataField';
import { DataWithDateFile } from './DatasetFile';
import { DatasetFileParams, IDatasetFileMeta } from './types';

export class RsdtdspRsdtFile
  extends DataWithDateFile
  implements IDatasetFileMeta
{
  get fields(): DataField[] {
    return [
      DataField.LG_CODE,
      DataField.TOWN_ID,
      DataField.BLK_ID,
      DataField.ADDR_ID,
      DataField.ADDR2_ID,
      DataField.CITY_NAME,
      DataField.OD_CITY_NAME,
      DataField.OAZA_TOWN_NAME,
      DataField.CHOME_NAME,
      DataField.KOAZA_NAME,
      DataField.BLK_NUM,
      DataField.RSDT_NUM,
      DataField.RSDT_NUM2,
      DataField.BASIC_RSDT_DIV,
      DataField.RSDT_ADDR_FLG,
      DataField.RSDT_ADDR_MTD_CODE,
      DataField.OAZA_FRN_LTRS_FLG,
      DataField.KOAZA_FRN_LTRS_FLG,
      DataField.STATUS_FLG,
      DataField.EFCT_DATE,
      DataField.ABLT_DATE,
      DataField.SRC_CODE,
      DataField.REMARKS,
    ];
  }

  constructor(params: DatasetFileParams) {
    super(params);
    Object.freeze(this);
  }

  static create(
    params: IDatasetFileMeta,
    inputStream: NodeJS.ReadableStream
  ): RsdtdspRsdtFile {
    const sql = `INSERT OR REPLACE INTO "rsdtdsp_rsdt"
      (
        ${DataField.LG_CODE.dbColumn},
        ${DataField.TOWN_ID.dbColumn},
        ${DataField.BLK_ID.dbColumn} ,
        ${DataField.ADDR_ID.dbColumn} ,
        ${DataField.ADDR2_ID.dbColumn} ,
        ${DataField.CITY_NAME.dbColumn} ,
        ${DataField.OD_CITY_NAME.dbColumn} ,
        ${DataField.OAZA_TOWN_NAME.dbColumn} ,
        ${DataField.CHOME_NAME.dbColumn} ,
        ${DataField.KOAZA_NAME.dbColumn} ,
        ${DataField.BLK_NUM.dbColumn} ,
        ${DataField.RSDT_NUM.dbColumn} ,
        ${DataField.RSDT_NUM2.dbColumn} ,
        ${DataField.BASIC_RSDT_DIV.dbColumn} ,
        ${DataField.RSDT_ADDR_FLG.dbColumn} ,
        ${DataField.RSDT_ADDR_MTD_CODE.dbColumn} ,
        ${DataField.OAZA_FRN_LTRS_FLG.dbColumn} ,
        ${DataField.KOAZA_FRN_LTRS_FLG.dbColumn} ,
        ${DataField.STATUS_FLG.dbColumn} ,
        ${DataField.EFCT_DATE.dbColumn} ,
        ${DataField.ABLT_DATE.dbColumn} ,
        ${DataField.SRC_CODE.dbColumn} ,
        ${DataField.REMARKS.dbColumn} 
      )
      VALUES
      (
        @${DataField.LG_CODE.dbColumn},
        @${DataField.TOWN_ID.dbColumn},
        @${DataField.BLK_ID.dbColumn} ,
        @${DataField.ADDR_ID.dbColumn} ,
        @${DataField.ADDR2_ID.dbColumn} ,
        @${DataField.CITY_NAME.dbColumn} ,
        @${DataField.OD_CITY_NAME.dbColumn} ,
        @${DataField.OAZA_TOWN_NAME.dbColumn} ,
        @${DataField.CHOME_NAME.dbColumn} ,
        @${DataField.KOAZA_NAME.dbColumn} ,
        @${DataField.BLK_NUM.dbColumn} ,
        @${DataField.RSDT_NUM.dbColumn} ,
        @${DataField.RSDT_NUM2.dbColumn} ,
        @${DataField.BASIC_RSDT_DIV.dbColumn} ,
        @${DataField.RSDT_ADDR_FLG.dbColumn} ,
        @${DataField.RSDT_ADDR_MTD_CODE.dbColumn} ,
        @${DataField.OAZA_FRN_LTRS_FLG.dbColumn} ,
        @${DataField.KOAZA_FRN_LTRS_FLG.dbColumn} ,
        @${DataField.STATUS_FLG.dbColumn} ,
        @${DataField.EFCT_DATE.dbColumn} ,
        @${DataField.ABLT_DATE.dbColumn} ,
        @${DataField.SRC_CODE.dbColumn} ,
        @${DataField.REMARKS.dbColumn} 
      )
      `;
    return new RsdtdspRsdtFile({
      ...params,
      sql,
      inputStream,
    });
  }
}
