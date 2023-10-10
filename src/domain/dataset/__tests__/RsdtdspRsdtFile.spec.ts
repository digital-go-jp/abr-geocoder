import { describe, expect, it } from '@jest/globals';
import { RsdtdspRsdtFile } from '../..';
import { IStreamReady } from '../../findTargetFilesInZipFiles';
import { IDatasetFileMeta } from '../../types';
import { DataField } from '../DataField';

describe('RsdtdspRsdtFile', () => {
  it.concurrent('should create an instance', async () => {
    const fileMeta: IDatasetFileMeta = {
      type: 'rsdtdsp_rsdt',
      fileArea: 'pref02',
      path: 'dummy',
      filename: 'mt_rsdtdsp_rsdt_pref02.csv',
    };

    const istreamReady: IStreamReady = {
      name: 'mt_rsdtdsp_rsdt_pref02.csv',
      crc32: 123456,
      contentLength: 123456,
      lastModified: 123456,
      getStream: function (): Promise<NodeJS.ReadableStream> {
        throw new Error('Function not implemented.');
      }
    }
    const instance = RsdtdspRsdtFile.create(fileMeta, istreamReady);
    expect(instance).not.toBeNull();
    expect(instance.filename).toBe('mt_rsdtdsp_rsdt_pref02.csv');
    expect(instance.type).toBe('rsdtdsp_rsdt');
    expect(instance.fields).toEqual([
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
    ]);
  });

  it.concurrent('should return expected values from a given row', async () => {
    const fileMeta: IDatasetFileMeta = {
      type: 'rsdtdsp_rsdt',
      fileArea: 'pref02',
      path: 'dummy',
      filename: 'mt_rsdtdsp_rsdt_pref02.csv',
    };
    const istreamReady: IStreamReady = {
      name: 'mt_rsdtdsp_rsdt_pref02.csv',
      crc32: 123456,
      contentLength: 123456,
      lastModified: 123456,
      getStream: function (): Promise<NodeJS.ReadableStream> {
        throw new Error('Function not implemented.');
      }
    }
    const instance = RsdtdspRsdtFile.create(fileMeta, istreamReady);
    const reuslt = instance.parseFields({
      [DataField.LG_CODE.csv] : '22012',
      [DataField.TOWN_ID.csv] : '2001',
      [DataField.BLK_ID.csv] : '1',
      [DataField.ADDR_ID.csv] : '1',
      [DataField.ADDR2_ID.csv] : '',
      [DataField.CITY_NAME.csv] : '青森市',
      [DataField.OD_CITY_NAME.csv] : '',
      [DataField.OAZA_TOWN_NAME.csv] : '青柳',
      [DataField.CHOME_NAME.csv] : '一丁目',
      [DataField.KOAZA_NAME.csv] : '',
      [DataField.BLK_NUM.csv] : '',
      [DataField.RSDT_NUM.csv] : '1',
      [DataField.RSDT_NUM2.csv] : '1',
      [DataField.BASIC_RSDT_DIV.csv] : '',
      [DataField.RSDT_ADDR_FLG.csv] : '0',
      [DataField.RSDT_ADDR_MTD_CODE.csv] : '1',
      [DataField.OAZA_FRN_LTRS_FLG.csv] : '1',
      [DataField.KOAZA_FRN_LTRS_FLG.csv] : '0',
      [DataField.STATUS_FLG.csv] : '0',
      [DataField.EFCT_DATE.csv] : '1947-04-17',
      [DataField.ABLT_DATE.csv] : '',
      [DataField.SRC_CODE.csv] : '0',
      [DataField.REMARKS.csv] : '',
    });
    				
    expect(reuslt).toMatchObject({
      [DataField.LG_CODE.dbColumn] : '22012',
      [DataField.TOWN_ID.dbColumn] : '2001',
      [DataField.BLK_ID.dbColumn] : '1',
      [DataField.ADDR_ID.dbColumn] : '1',
      [DataField.ADDR2_ID.dbColumn] : '',
      [DataField.CITY_NAME.dbColumn] : '青森市',
      [DataField.OD_CITY_NAME.dbColumn] : '',
      [DataField.OAZA_TOWN_NAME.dbColumn] : '青柳',
      [DataField.CHOME_NAME.dbColumn] : '一丁目',
      [DataField.KOAZA_NAME.dbColumn] : '',
      [DataField.BLK_NUM.dbColumn] : '',
      [DataField.RSDT_NUM.dbColumn] : '1',
      [DataField.RSDT_NUM2.dbColumn] : '1',
      [DataField.BASIC_RSDT_DIV.dbColumn] : '',
      [DataField.RSDT_ADDR_FLG.dbColumn] : '0',
      [DataField.RSDT_ADDR_MTD_CODE.dbColumn] : '1',
      [DataField.OAZA_FRN_LTRS_FLG.dbColumn] : '1',
      [DataField.KOAZA_FRN_LTRS_FLG.dbColumn] : '0',
      [DataField.STATUS_FLG.dbColumn] : '0',
      [DataField.EFCT_DATE.dbColumn] : '1947-04-17',
      [DataField.ABLT_DATE.dbColumn] : '',
      [DataField.SRC_CODE.dbColumn] : '0',
      [DataField.REMARKS.dbColumn] : '',
    });
  });
})