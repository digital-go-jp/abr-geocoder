import { describe, expect, it } from '@jest/globals';
import { IDatasetFileMeta } from '../../dataset-file';
import { IStreamReady } from '../../istream-ready';
import { DataField } from '../data-field';
import { PrefDatasetFile } from '../pref-dataset-file';

describe('PrefDatasetFile', () => {
  it.concurrent('should create an instance', async () => {
    const fileMeta: IDatasetFileMeta = {
      type: 'pref',
      fileArea: 'all',
      path: 'dummy',
      filename: 'mt_pref_all.csv',
    };

    const istreamReady: IStreamReady = {
      name: 'mt_pref_all.csv',
      crc32: 123456,
      contentLength: 123456,
      lastModified: 123456,
      getStream: function (): Promise<NodeJS.ReadableStream> {
        throw new Error('Function not implemented.');
      }
    }
    const instance = PrefDatasetFile.create(fileMeta, istreamReady);
    expect(instance).not.toBeNull();
    expect(instance.filename).toBe('mt_pref_all.csv');
    expect(instance.type).toBe('pref');
    expect(instance.fields).toEqual([
      DataField.LG_CODE,
      DataField.PREF_NAME,
      DataField.PREF_NAME_KANA,
      DataField.PREF_NAME_ROMA,
      DataField.EFCT_DATE,
      DataField.ABLT_DATE,
      DataField.REMARKS,
    ]);
  });

  it.concurrent('should return expected values from a given row', async () => {
    const fileMeta: IDatasetFileMeta = {
      type: 'city',
      fileArea: 'all',
      path: 'dummy',
      filename: 'mt_pref_all.csv',
    };

    const istreamReady: IStreamReady = {
      name: 'mt_pref_all.csv',
      crc32: 123456,
      contentLength: 123456,
      lastModified: 123456,
      getStream: function (): Promise<NodeJS.ReadableStream> {
        throw new Error('Function not implemented.');
      }
    }
    															
    const instance = PrefDatasetFile.create(fileMeta, istreamReady);
    const reuslt = instance.parseFields({
      [DataField.LG_CODE.csv]: '10006',
      [DataField.PREF_NAME.csv]: '北海道',
      [DataField.PREF_NAME_KANA.csv]: 'ホッカイドウ',
      [DataField.PREF_NAME_ROMA.csv]: 'Hokkaido',
      [DataField.EFCT_DATE.csv]: '1947-04-17',
      [DataField.ABLT_DATE.csv]: '',
      [DataField.REMARKS.csv]: '',
    });
    				
    expect(reuslt).toMatchObject({
      [DataField.LG_CODE.dbColumn]: '10006',
      [DataField.PREF_NAME.dbColumn]: '北海道',
      [DataField.PREF_NAME_KANA.dbColumn]: 'ホッカイドウ',
      [DataField.PREF_NAME_ROMA.dbColumn]: 'Hokkaido',
      [DataField.EFCT_DATE.dbColumn]: '1947-04-17',
      [DataField.ABLT_DATE.dbColumn]: '',
      [DataField.REMARKS.dbColumn]: '',
    });
  });
})