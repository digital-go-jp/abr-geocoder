import { IDatasetFileMeta } from '@domain/dataset-file';
import { DataField } from '@domain/dataset/data-field';
import { IStreamReady } from '@domain/istream-ready';
import { describe, expect, it } from '@jest/globals';
import { TownDatasetFile } from '../town-dataset-file';

describe('TownDatasetFile', () => {
  it.concurrent('should create an instance', async () => {
    const fileMeta: IDatasetFileMeta = {
      type: 'town',
      fileArea: 'all',
      path: 'dummy',
      filename: 'mt_town_all.csv',
    };

    const istreamReady: IStreamReady = {
      name: 'mt_town_all.csv',
      crc32: 123456,
      contentLength: 123456,
      lastModified: 123456,
      getStream: function (): Promise<NodeJS.ReadableStream> {
        throw new Error('Function not implemented.');
      }
    }
    const instance = TownDatasetFile.create(fileMeta, istreamReady);
    expect(instance).not.toBeNull();
    expect(instance.filename).toBe('mt_town_all.csv');
    expect(instance.type).toBe('town');
    expect(instance.fields).toEqual([
      DataField.LG_CODE,
      DataField.TOWN_ID,
      DataField.TOWN_CODE,
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
      DataField.OAZA_TOWN_NAME,
      DataField.OAZA_TOWN_NAME_KANA,
      DataField.OAZA_TOWN_NAME_ROMA,
      DataField.CHOME_NAME,
      DataField.CHOME_NAME_KANA,
      DataField.CHOME_NAME_NUMBER,
      DataField.KOAZA_NAME,
      DataField.KOAZA_NAME_KANA,
      DataField.KOAZA_NAME_ROMA,
      DataField.RSDT_ADDR_FLG,
      DataField.RSDT_ADDR_MTD_CODE,
      DataField.OAZA_TOWN_ALT_NAME_FLG,
      DataField.KOAZA_FRN_LTRS_FLG,
      DataField.OAZA_FRN_LTRS_FLG,
      DataField.KOAZA_FRN_LTRS_FLG,
      DataField.STATUS_FLG,
      DataField.WAKE_NUM_FLG,
      DataField.EFCT_DATE,
      DataField.ABLT_DATE,
      DataField.SRC_CODE,
      DataField.POST_CODE,
      DataField.REMARKS,
    ]);
  });

  it.concurrent('should return expected values from a given row', async () => {
    const fileMeta: IDatasetFileMeta = {
      type: 'town',
      fileArea: 'all',
      path: 'dummy',
      filename: 'mt_town_all.csv',
    };
    const istreamReady: IStreamReady = {
      name: 'mt_town_all.csv',
      crc32: 123456,
      contentLength: 123456,
      lastModified: 123456,
      getStream: function (): Promise<NodeJS.ReadableStream> {
        throw new Error('Function not implemented.');
      }
    }
    const instance = TownDatasetFile.create(fileMeta, istreamReady);
    const reuslt = instance.parseFields({
      [DataField.LG_CODE.csv] : '11011',
      [DataField.TOWN_ID.csv] : '1001',
      [DataField.TOWN_CODE.csv] : '2',
      [DataField.PREF_NAME.csv] : '北海道',
      [DataField.PREF_NAME_KANA.csv] : 'ホッカイドウ',
      [DataField.PREF_NAME_ROMA.csv] : 'Hokkaido',
      [DataField.COUNTY_NAME.csv] : '',
      [DataField.COUNTY_NAME_KANA.csv] : '',
      [DataField.COUNTY_NAME_ROMA.csv] : '',
      [DataField.CITY_NAME.csv] : '札幌市',
      [DataField.CITY_NAME_KANA.csv] : 'サッポロシ',
      [DataField.CITY_NAME_ROMA.csv] : 'Sapporo-shi',
      [DataField.OD_CITY_NAME.csv] : '中央区',
      [DataField.OD_CITY_NAME_KANA.csv] : 'チュウオウク',
      [DataField.OD_CITY_NAME_ROMA.csv] : 'Chuo-ku',
      [DataField.OAZA_TOWN_NAME.csv] : '旭ケ丘',
      [DataField.OAZA_TOWN_NAME_KANA.csv] : 'アサヒガオカ',
      [DataField.OAZA_TOWN_NAME_ROMA.csv] : 'Asahigaoka',
      [DataField.CHOME_NAME.csv] : '一丁目',
      [DataField.CHOME_NAME_KANA.csv] : '１チョウメ',
      [DataField.CHOME_NAME_NUMBER.csv] : '1',
      [DataField.KOAZA_NAME.csv] : '',
      [DataField.KOAZA_NAME_KANA.csv] : '',
      [DataField.KOAZA_NAME_ROMA.csv] : '',
      [DataField.RSDT_ADDR_FLG.csv] : '1',
      [DataField.RSDT_ADDR_MTD_CODE.csv] : '1',
      [DataField.OAZA_TOWN_ALT_NAME_FLG.csv] : '0',
      [DataField.KOAZA_FRN_LTRS_FLG.csv] : '0',
      [DataField.OAZA_FRN_LTRS_FLG.csv] : '0',
      [DataField.KOAZA_FRN_LTRS_FLG.csv] : '0',
      [DataField.STATUS_FLG.csv] : '0',
      [DataField.WAKE_NUM_FLG.csv] : '0',
      [DataField.EFCT_DATE.csv] : '1947-04-17',
      [DataField.ABLT_DATE.csv] : '',
      [DataField.SRC_CODE.csv] : '0',
      [DataField.POST_CODE.csv] : '',
      [DataField.REMARKS.csv] : '',
    });
    				
    expect(reuslt).toMatchObject({
      [DataField.LG_CODE.dbColumn] : '11011',
      [DataField.TOWN_ID.dbColumn] : '1001',
      [DataField.TOWN_CODE.dbColumn] : '2',
      [DataField.PREF_NAME.dbColumn] : '北海道',
      [DataField.PREF_NAME_KANA.dbColumn] : 'ホッカイドウ',
      [DataField.PREF_NAME_ROMA.dbColumn] : 'Hokkaido',
      [DataField.COUNTY_NAME.dbColumn] : '',
      [DataField.COUNTY_NAME_KANA.dbColumn] : '',
      [DataField.COUNTY_NAME_ROMA.dbColumn] : '',
      [DataField.CITY_NAME.dbColumn] : '札幌市',
      [DataField.CITY_NAME_KANA.dbColumn] : 'サッポロシ',
      [DataField.CITY_NAME_ROMA.dbColumn] : 'Sapporo-shi',
      [DataField.OD_CITY_NAME.dbColumn] : '中央区',
      [DataField.OD_CITY_NAME_KANA.dbColumn] : 'チュウオウク',
      [DataField.OD_CITY_NAME_ROMA.dbColumn] : 'Chuo-ku',
      [DataField.OAZA_TOWN_NAME.dbColumn] : '旭ケ丘',
      [DataField.OAZA_TOWN_NAME_KANA.dbColumn] : 'アサヒガオカ',
      [DataField.OAZA_TOWN_NAME_ROMA.dbColumn] : 'Asahigaoka',
      [DataField.CHOME_NAME.dbColumn] : '一丁目',
      [DataField.CHOME_NAME_KANA.dbColumn] : '１チョウメ',
      [DataField.CHOME_NAME_NUMBER.dbColumn] : '1',
      [DataField.KOAZA_NAME.dbColumn] : '',
      [DataField.KOAZA_NAME_KANA.dbColumn] : '',
      [DataField.KOAZA_NAME_ROMA.dbColumn] : '',
      [DataField.RSDT_ADDR_FLG.dbColumn] : '1',
      [DataField.RSDT_ADDR_MTD_CODE.dbColumn] : '1',
      [DataField.OAZA_TOWN_ALT_NAME_FLG.dbColumn] : '0',
      [DataField.KOAZA_FRN_LTRS_FLG.dbColumn] : '0',
      [DataField.OAZA_FRN_LTRS_FLG.dbColumn] : '0',
      [DataField.KOAZA_FRN_LTRS_FLG.dbColumn] : '0',
      [DataField.STATUS_FLG.dbColumn] : '0',
      [DataField.WAKE_NUM_FLG.dbColumn] : '0',
      [DataField.EFCT_DATE.dbColumn] : '1947-04-17',
      [DataField.ABLT_DATE.dbColumn] : '',
      [DataField.SRC_CODE.dbColumn] : '0',
      [DataField.POST_CODE.dbColumn] : '',
      [DataField.REMARKS.dbColumn] : '',
    });
  });
})