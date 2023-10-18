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
import { CityDatasetFile } from '../city-dataset-file';
import { DataField } from '@domain/dataset/data-field';
import { IStreamReady } from '@domain/istream-ready';
import { describe, expect, it } from '@jest/globals';

describe('CityDatasetFile', () => {
  it.concurrent('should create an instance', async () => {
    const fileMeta: IDatasetFileMeta = {
      type: 'city',
      fileArea: 'all',
      path: 'dummy',
      filename: 'mt_city_all.csv',
    };

    const istreamReady: IStreamReady = {
      name: 'mt_city_all.csv',
      crc32: 123456,
      contentLength: 123456,
      lastModified: 123456,
      getStream: function (): Promise<NodeJS.ReadableStream> {
        throw new Error('Function not implemented.');
      }
    }
    const instance = CityDatasetFile.create(fileMeta, istreamReady);
    expect(instance).not.toBeNull();
    expect(instance.filename).toBe('mt_city_all.csv');
    expect(instance.type).toBe('city');
    expect(instance.fields).toEqual([
      DataField.LG_CODE,
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
      filename: 'mt_city_all.csv',
    };

    const istreamReady: IStreamReady = {
      name: 'mt_city_all.csv',
      crc32: 123456,
      contentLength: 123456,
      lastModified: 123456,
      getStream: function (): Promise<NodeJS.ReadableStream> {
        throw new Error('Function not implemented.');
      }
    }
    															
    const instance = CityDatasetFile.create(fileMeta, istreamReady);
    const reuslt = instance.parseFields({
      [DataField.LG_CODE.csv]: '11011',
      [DataField.PREF_NAME.csv]: '北海道',
      [DataField.PREF_NAME_KANA.csv]: 'ホッカイドウ',
      [DataField.PREF_NAME_ROMA.csv]: 'Hokkaido',
      [DataField.COUNTY_NAME.csv]: '',
      [DataField.COUNTY_NAME_KANA.csv]: '',
      [DataField.COUNTY_NAME_ROMA.csv]: '',
      [DataField.CITY_NAME.csv]: '札幌市',
      [DataField.CITY_NAME_KANA.csv]: 'サッポロシ',
      [DataField.CITY_NAME_ROMA.csv]: 'Sapporo-shi',
      [DataField.OD_CITY_NAME.csv]: '中央区',
      [DataField.OD_CITY_NAME_KANA.csv]: 'チュウオウク',
      [DataField.OD_CITY_NAME_ROMA.csv]: '',
      [DataField.EFCT_DATE.csv]: '1947-04-17',
      [DataField.ABLT_DATE.csv]: 'Chuo-ku',
      [DataField.REMARKS.csv]: '',
    });

    expect(reuslt).toMatchObject({
      [DataField.LG_CODE.dbColumn]: '11011',
      [DataField.PREF_NAME.dbColumn]: '北海道',
      [DataField.PREF_NAME_KANA.dbColumn]: 'ホッカイドウ',
      [DataField.PREF_NAME_ROMA.dbColumn]: 'Hokkaido',
      [DataField.COUNTY_NAME.dbColumn]: '',
      [DataField.COUNTY_NAME_KANA.dbColumn]: '',
      [DataField.COUNTY_NAME_ROMA.dbColumn]: '',
      [DataField.CITY_NAME.dbColumn]: '札幌市',
      [DataField.CITY_NAME_KANA.dbColumn]: 'サッポロシ',
      [DataField.CITY_NAME_ROMA.dbColumn]: 'Sapporo-shi',
      [DataField.OD_CITY_NAME.dbColumn]: '中央区',
      [DataField.OD_CITY_NAME_KANA.dbColumn]: 'チュウオウク',
      [DataField.OD_CITY_NAME_ROMA.dbColumn]: '',
      [DataField.EFCT_DATE.dbColumn]: '1947-04-17',
      [DataField.ABLT_DATE.dbColumn]: 'Chuo-ku',
      [DataField.REMARKS.dbColumn]: '',
    });
  });
})