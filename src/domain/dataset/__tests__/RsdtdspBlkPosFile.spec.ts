import { describe, expect, it } from '@jest/globals';
import { RsdtdspBlkPosFile } from '../..';
import { IStreamReady } from '../../findTargetFilesInZipFiles';
import { IDatasetFileMeta } from '../../types';
import { DataField } from '../DataField';

describe('RsdtdspBlkPosFile', () => {
  it.concurrent('should create an instance', async () => {
    const fileMeta: IDatasetFileMeta = {
      type: 'rsdtdsp_blk_pos',
      fileArea: 'pref01',
      path: 'dummy',
      filename: 'mt_rsdtdsp_blk_pos_pref01.csv',
    };

    const istreamReady: IStreamReady = {
      name: 'mt_rsdtdsp_blk_pos_pref01.csv',
      crc32: 123456,
      contentLength: 123456,
      lastModified: 123456,
      getStream: function (): Promise<NodeJS.ReadableStream> {
        throw new Error('Function not implemented.');
      }
    }
    const instance = RsdtdspBlkPosFile.create(fileMeta, istreamReady);
    expect(instance).not.toBeNull();
    expect(instance.filename).toBe('mt_rsdtdsp_blk_pos_pref01.csv');
    expect(instance.type).toBe('rsdtdsp_blk_pos');
    expect(instance.fields).toEqual([
      DataField.LG_CODE,
      DataField.REP_PNT_LON,
      DataField.REP_PNT_LAT,
      DataField.TOWN_ID,
      DataField.BLK_ID,
    ]);
  });

  it.concurrent('should return expected values from a given row', async () => {
    const fileMeta: IDatasetFileMeta = {
      type: 'rsdtdsp_blk_pos',
      fileArea: 'pref01',
      path: 'dummy',
      filename: 'mt_rsdtdsp_blk_pos_pref01.csv',
    };
    const istreamReady: IStreamReady = {
      name: 'mt_rsdtdsp_blk_pos_pref01.csv',
      crc32: 123456,
      contentLength: 123456,
      lastModified: 123456,
      getStream: function (): Promise<NodeJS.ReadableStream> {
        throw new Error('Function not implemented.');
      }
    }
    const instance = RsdtdspBlkPosFile.create(fileMeta, istreamReady);
    const reuslt = instance.parseFields({
      [DataField.LG_CODE.csv] : '11011',
      [DataField.REP_PNT_LON.csv] : '141.319906',
      [DataField.REP_PNT_LAT.csv] : '43.04383',
      [DataField.TOWN_ID.csv] : '1001',
      [DataField.BLK_ID.csv] : '1',
    });
    				
    expect(reuslt).toMatchObject({
      [DataField.LG_CODE.dbColumn] : '11011',
      [DataField.REP_PNT_LON.dbColumn] : '141.319906',
      [DataField.REP_PNT_LAT.dbColumn] : '43.04383',
      [DataField.TOWN_ID.dbColumn] : '1001',
      [DataField.BLK_ID.dbColumn] : '1',
    });
  });
})