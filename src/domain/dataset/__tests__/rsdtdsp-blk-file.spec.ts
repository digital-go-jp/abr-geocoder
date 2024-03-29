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
import { RsdtdspBlkFile } from '../rsdtdsp-blk-file';
import { IStreamReady } from '@domain/istream-ready';
import { describe, expect, it } from '@jest/globals';
describe('RsdtdspBlkFile', () => {
  it.concurrent('should create an instance', async () => {
    const fileMeta: IDatasetFileMeta = {
      type: 'rsdtdsp_blk',
      fileArea: 'pref01',
      path: 'dummy',
      filename: 'mt_rsdtdsp_blk_pref01.csv',
    };

    const istreamReady: IStreamReady = {
      name: 'mt_rsdtdsp_blk_pref01.csv',
      crc32: 123456,
      contentLength: 123456,
      lastModified: 123456,
      getStream: function (): Promise<NodeJS.ReadableStream> {
        throw new Error('Function not implemented.');
      }
    }
    const instance = RsdtdspBlkFile.create(fileMeta, istreamReady);
    expect(instance).not.toBeNull();
    expect(instance.filename).toBe('mt_rsdtdsp_blk_pref01.csv');
    expect(instance.type).toBe('rsdtdsp_blk');
    expect(instance.fields).toEqual([
      DataField.LG_CODE,
      DataField.TOWN_ID,
      DataField.BLK_ID,
      DataField.CITY_NAME,
      DataField.OD_CITY_NAME,
      DataField.OAZA_TOWN_NAME,
      DataField.CHOME_NAME,
      DataField.KOAZA_NAME,
      DataField.BLK_NUM,
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
      type: 'rsdtdsp_blk',
      fileArea: 'pref01',
      path: 'dummy',
      filename: 'mt_rsdtdsp_blk_pref01.csv',
    };
    const istreamReady: IStreamReady = {
      name: 'mt_rsdtdsp_blk_pref01.csv',
      crc32: 123456,
      contentLength: 123456,
      lastModified: 123456,
      getStream: function (): Promise<NodeJS.ReadableStream> {
        throw new Error('Function not implemented.');
      }
    }
	
    const instance = RsdtdspBlkFile.create(fileMeta, istreamReady);
    const reuslt = instance.parseFields({
      [DataField.LG_CODE.csv]: '11011',
      [DataField.TOWN_ID.csv]: '1001',
      [DataField.BLK_ID.csv]: '1',
      [DataField.CITY_NAME.csv]: '札幌市',
      [DataField.OD_CITY_NAME.csv]: '中央区',
      [DataField.OAZA_TOWN_NAME.csv]: '旭ケ丘',
      [DataField.CHOME_NAME.csv]: '一丁目',
      [DataField.KOAZA_NAME.csv]: '',
      [DataField.BLK_NUM.csv]: '1',
      [DataField.RSDT_ADDR_FLG.csv]: '1',
      [DataField.RSDT_ADDR_MTD_CODE.csv]: '1',
      [DataField.OAZA_FRN_LTRS_FLG.csv]: '0',
      [DataField.KOAZA_FRN_LTRS_FLG.csv]: '0',
      [DataField.STATUS_FLG.csv]: '0',
      [DataField.EFCT_DATE.csv]: '1947-04-17',
      [DataField.ABLT_DATE.csv]: '',
      [DataField.SRC_CODE.csv]: '0',
      [DataField.REMARKS.csv]: '',
    });
    				
    expect(reuslt).toMatchObject({
      [DataField.LG_CODE.dbColumn]: '11011',
      [DataField.TOWN_ID.dbColumn]: '1001',
      [DataField.BLK_ID.dbColumn]: '1',
      [DataField.CITY_NAME.dbColumn]: '札幌市',
      [DataField.OD_CITY_NAME.dbColumn]: '中央区',
      [DataField.OAZA_TOWN_NAME.dbColumn]: '旭ケ丘',
      [DataField.CHOME_NAME.dbColumn]: '一丁目',
      [DataField.KOAZA_NAME.dbColumn]: '',
      [DataField.BLK_NUM.dbColumn]: '1',
      [DataField.RSDT_ADDR_FLG.dbColumn]: '1',
      [DataField.RSDT_ADDR_MTD_CODE.dbColumn]: '1',
      [DataField.OAZA_FRN_LTRS_FLG.dbColumn]: '0',
      [DataField.KOAZA_FRN_LTRS_FLG.dbColumn]: '0',
      [DataField.STATUS_FLG.dbColumn]: '0',
      [DataField.EFCT_DATE.dbColumn]: '1947-04-17',
      [DataField.ABLT_DATE.dbColumn]: '',
      [DataField.SRC_CODE.dbColumn]: '0',
      [DataField.REMARKS.dbColumn]: '',
    });
  });
})