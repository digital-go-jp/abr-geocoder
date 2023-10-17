/*!
 * MIT License
 *
 * Copyright (c) 2023 デジタル庁
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { IDatasetFileMeta } from '@domain/dataset-file';
import { DataField } from '@domain/dataset/data-field';
import { RsdtdspBlkPosFile } from '../rsdtdsp-blk-pos-file';
import { IStreamReady } from '@domain/istream-ready';
import { describe, expect, it } from '@jest/globals';

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