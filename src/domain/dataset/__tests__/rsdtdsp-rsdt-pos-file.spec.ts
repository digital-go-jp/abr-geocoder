import { describe, expect, it } from '@jest/globals';
import { IDatasetFileMeta, IStreamReady, RsdtdspRsdtPosFile } from '../..';
import { DataField } from '../data-field';

describe('RsdtdspRsdtPosFile', () => {
  it.concurrent('should create an instance', async () => {
    const fileMeta: IDatasetFileMeta = {
      type: 'rsdtdsp_rsdt_pos',
      fileArea: 'pref05',
      path: 'dummy',
      filename: 'mt_rsdtdsp_rsdt_pos_pref05.csv',
    };

    const istreamReady: IStreamReady = {
      name: 'mt_rsdtdsp_rsdt_pos_pref05.csv',
      crc32: 123456,
      contentLength: 123456,
      lastModified: 123456,
      getStream: function (): Promise<NodeJS.ReadableStream> {
        throw new Error('Function not implemented.');
      }
    }
    const instance = RsdtdspRsdtPosFile.create(fileMeta, istreamReady);
    expect(instance).not.toBeNull();
    expect(instance.filename).toBe('mt_rsdtdsp_rsdt_pos_pref05.csv');
    expect(instance.type).toBe('rsdtdsp_rsdt_pos');
    expect(instance.fields).toEqual([
      DataField.LG_CODE,
      DataField.REP_PNT_LAT,
      DataField.REP_PNT_LON,
      DataField.TOWN_ID,
      DataField.BLK_ID,
      DataField.ADDR_ID,
      DataField.ADDR2_ID,
    ]);
  });

  it.concurrent('should return expected values from a given row', async () => {
    const fileMeta: IDatasetFileMeta = {
      type: 'rsdtdsp_rsdt_pos',
      fileArea: 'pref05',
      path: 'dummy',
      filename: 'mt_rsdtdsp_rsdt_pos_pref05.csv',
    };
    const istreamReady: IStreamReady = {
      name: 'mt_rsdtdsp_rsdt_pos_pref05.csv',
      crc32: 123456,
      contentLength: 123456,
      lastModified: 123456,
      getStream: function (): Promise<NodeJS.ReadableStream> {
        throw new Error('Function not implemented.');
      }
    }
    const instance = RsdtdspRsdtPosFile.create(fileMeta, istreamReady);
    const reuslt = instance.parseFields({
      [DataField.LG_CODE.csv] : '52027',
      [DataField.REP_PNT_LAT.csv] : '40.200984603',
      [DataField.REP_PNT_LON.csv] : '140.021214247',
      [DataField.TOWN_ID.csv] : '1000',
      [DataField.BLK_ID.csv] : '1',
      [DataField.ADDR_ID.csv] : '1',
      [DataField.ADDR2_ID.csv] : '',
    });
    				
    expect(reuslt).toMatchObject({
      [DataField.LG_CODE.dbColumn] : '52027',
      [DataField.REP_PNT_LAT.dbColumn] : '40.200984603',
      [DataField.REP_PNT_LON.dbColumn] : '140.021214247',
      [DataField.TOWN_ID.dbColumn] : '1000',
      [DataField.BLK_ID.dbColumn] : '1',
      [DataField.ADDR_ID.dbColumn] : '1',
      [DataField.ADDR2_ID.dbColumn] : '',
    });
  });
})