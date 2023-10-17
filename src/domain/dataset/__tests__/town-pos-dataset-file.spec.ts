import { describe, expect, it } from '@jest/globals';
import { IDatasetFileMeta, IStreamReady, TownPosDatasetFile } from '@domain';
import { DataField } from '@domain/dataset/data-field';

describe('TownPosDatasetFile', () => {
  it.concurrent('should create an instance', async () => {
    const fileMeta: IDatasetFileMeta = {
      type: 'town_pos',
      fileArea: 'pref47',
      path: 'dummy',
      filename: 'mt_town_pos_pref47.csv',
    };

    const istreamReady: IStreamReady = {
      name: 'mt_town_pos_pref47.csv',
      crc32: 123456,
      contentLength: 123456,
      lastModified: 123456,
      getStream: function (): Promise<NodeJS.ReadableStream> {
        throw new Error('Function not implemented.');
      }
    }
    const instance = TownPosDatasetFile.create(fileMeta, istreamReady);
    expect(instance).not.toBeNull();
    expect(instance.filename).toBe('mt_town_pos_pref47.csv');
    expect(instance.type).toBe('town_pos');
    expect(instance.fields).toEqual([
      DataField.LG_CODE,
      DataField.REP_PNT_LAT,
      DataField.REP_PNT_LON,
      DataField.TOWN_ID,
    ]);
  });

  it.concurrent('should return expected values from a given row', async () => {
    const fileMeta: IDatasetFileMeta = {
      type: 'town_pos',
      fileArea: 'pref47',
      path: 'dummy',
      filename: 'mt_town_pos_pref47.csv',
    };
    const istreamReady: IStreamReady = {
      name: 'mt_town_pos_pref47.csv',
      crc32: 123456,
      contentLength: 123456,
      lastModified: 123456,
      getStream: function (): Promise<NodeJS.ReadableStream> {
        throw new Error('Function not implemented.');
      }
    }
    const instance = TownPosDatasetFile.create(fileMeta, istreamReady);
    const reuslt = instance.parseFields({
      [DataField.LG_CODE.csv] : '472018',
      [DataField.REP_PNT_LAT.csv] : '26.199562',
      [DataField.REP_PNT_LON.csv] : '127.691306',
      [DataField.TOWN_ID.csv] : '1001',
    });
    				
    expect(reuslt).toMatchObject({
      [DataField.LG_CODE.dbColumn] : '472018',
      [DataField.REP_PNT_LAT.dbColumn] : '26.199562',
      [DataField.REP_PNT_LON.dbColumn] : '127.691306',
      [DataField.TOWN_ID.dbColumn] : '1001',
    });
  });
})