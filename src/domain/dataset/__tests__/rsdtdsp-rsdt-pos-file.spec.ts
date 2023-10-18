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
import { IStreamReady } from '@domain/istream-ready';
import { describe, expect, it } from '@jest/globals';
import { RsdtdspRsdtPosFile } from '../rsdtdsp-rsdt-pos-file';

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