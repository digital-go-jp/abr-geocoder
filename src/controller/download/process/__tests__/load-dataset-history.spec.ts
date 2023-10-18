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

import MockedDB from '@mock/better-sqlite3';
import { describe, expect, it, jest } from "@jest/globals";
import { loadDatasetHistory } from '../load-dataset-history';
import { expectedResult } from '../__mocks__/load-dataset-history';
jest.mock('better-sqlite3');
jest.dontMock('../load-dataset-history')

describe('load-dataset-history', () => {
  it('should return a Map<string, DatasetRow>', async () => {
    const db = new MockedDB('dummy database');
    db.prepare.mockImplementation(() => ({
      all: jest.fn().mockReturnValue([
        {
          key: 'mt_city_all.csv',
          type: 'city',
          content_length: 237764,
          crc32: 814415613,
          last_modified: 1674556098000,
        },
  
        {
          key: 'mt_pref_all.csv',
          type: 'pref',
          content_length: 2758,
          crc32: 956018549,
          last_modified: 1641570854000,
        },
  
        {
          key: 'mt_rsdtdsp_blk_pref01.csv',
          type: 'rsdtdsp_blk',
          content_length: 7434057,
          crc32: 1012054291,
          last_modified: 1674556144000,
        },
  
        {
          key: 'mt_rsdtdsp_rsdt_pref01.csv',
          type: 'rsdtdsp_rsdt',
          content_length: 174393385,
          crc32: 3685780372,
          last_modified: 1674556208000,
        },
  
        {
          key: 'mt_town_all.csv',
          type: 'town',
          content_length: 152740134,
          crc32: 3996387812,
          last_modified: 1674556118000,
        },
  
        {
          key: 'mt_rsdtdsp_blk_pos_pref01.csv',
          type: 'rsdtdsp_blk_pos',
          content_length: 15992158,
          crc32: 3050934268,
          last_modified: 1674556152000,
        },
  
        {
          key: 'mt_rsdtdsp_rsdt_pos_pref01.csv',
          type: 'rsdtdsp_rsdt_pos',
          content_length: 229730854,
          crc32: 3025020626,
          last_modified: 1674556268000,
        },
  
        {
          key: 'mt_town_pos_pref01.csv',
          type: 'town_pos',
          content_length: 2229768,
          crc32: 4236985285,
          last_modified: 1674556138000,
        }
      ]),
    }));

    const results = await loadDatasetHistory({
      db,
    });

    expect(results).toEqual(expectedResult);
  })
})