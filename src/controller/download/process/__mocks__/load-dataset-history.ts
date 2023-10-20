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
import { DatasetRow } from "@domain/dataset/dataset-row";
import { jest } from '@jest/globals';
import { Database } from "better-sqlite3";

export const expectedResult = new Map<string, DatasetRow>([
  ['mt_city_all.csv', new DatasetRow({
    key: 'mt_city_all.csv',
    type: 'city',
    contentLength: 237764,
    crc32: 814415613,
    lastModified: 1674556098000,
  })],
  ['mt_pref_all.csv', new DatasetRow({
    key: 'mt_pref_all.csv',
    type: 'pref',
    contentLength: 2758,
    crc32: 956018549,
    lastModified: 1641570854000,
  })],
  ['mt_rsdtdsp_blk_pref01.csv', new DatasetRow({
    key: 'mt_rsdtdsp_blk_pref01.csv',
    type: 'rsdtdsp_blk',
    contentLength: 7434057,
    crc32: 1012054291,
    lastModified: 1674556144000,
  })],
  ['mt_rsdtdsp_rsdt_pref01.csv', new DatasetRow({
    key: 'mt_rsdtdsp_rsdt_pref01.csv',
    type: 'rsdtdsp_rsdt',
    contentLength: 174393385,
    crc32: 3685780372,
    lastModified: 1674556208000,
  })],
  ['mt_town_all.csv', new DatasetRow({
    key: 'mt_town_all.csv',
    type: 'town',
    contentLength: 152740134,
    crc32: 3996387812,
    lastModified: 1674556118000,
  })],
  ['mt_rsdtdsp_blk_pos_pref01.csv', new DatasetRow({
    key: 'mt_rsdtdsp_blk_pos_pref01.csv',
    type: 'rsdtdsp_blk_pos',
    contentLength: 15992158,
    crc32: 3050934268,
    lastModified: 1674556152000,
  })],
  ['mt_rsdtdsp_rsdt_pos_pref01.csv', new DatasetRow({
    key: 'mt_rsdtdsp_rsdt_pos_pref01.csv',
    type: 'rsdtdsp_rsdt_pos',
    contentLength: 229730854,
    crc32: 3025020626,
    lastModified: 1674556268000,
  })],
  ['mt_town_pos_pref01.csv', new DatasetRow({
    key: 'mt_town_pos_pref01.csv',
    type: 'town_pos',
    contentLength: 2229768,
    crc32: 4236985285,
    lastModified: 1674556138000,
  })],
]);

export const loadDatasetHistory = jest.fn(async (params: {
  db: Database,
}): Promise<Map<string, DatasetRow>> => {
  return Promise.resolve(expectedResult);
});