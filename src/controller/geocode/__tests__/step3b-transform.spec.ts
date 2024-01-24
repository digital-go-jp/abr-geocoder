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
import { FromStep3Type } from '@domain/from-step3-type';
import { AddressFinderForStep3and5 } from '@usecase/geocode/address-finder-for-step3and5';
import { MatchLevel } from '@domain/match-level';
import { PrefectureName } from '@domain/prefecture-name';
import { Query } from '@domain/query';
import { describe, expect, it, jest } from '@jest/globals';
import Database from 'better-sqlite3';
import Stream from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { GeocodingStep3B } from '../step3b-transform';
import { WritableStreamToArray } from './stream-to-array.skip';

jest.mock<AddressFinderForStep3and5>('@usecase/geocode/address-finder-for-step3and5');
jest.mock('better-sqlite3');

describe('step3b-transform', () => {
  it('複数の都道府県名にマッチする場合は、町名まで正規化して都道府県名を判別する', async () => {
    // 東京都府中市と にマッチする
    const dummyCallback = jest.fn();

    const db = new Database('dummy');
    const wildcardHelper = (address: string) => address;

    const finder = new AddressFinderForStep3and5({
      db,
      wildcardHelper,
    });
    const target = new GeocodingStep3B(finder);
    const outputWrite = new WritableStreamToArray<Query>();
    const matchedPatterns = [
      {
        prefecture: PrefectureName.HIROSHIMA,
        city: '府中市',
        tempAddress: '宮西町2丁目24番地',
      },
      {
        prefecture: PrefectureName.TOKYO,
        city: '府中市',
        tempAddress: '宮西町2丁目24番地',
      },
    ];

    const fromStep3: FromStep3Type = {
      query: Query.create('府中市宮西町2丁目24番地'),
      callback: dummyCallback,
    };
    await pipeline(
      Stream.Readable.from(
        [
          {
            fromStep3,
            matchedPatterns,
          },
        ],
        {
          objectMode: true,
        }
      ),
      target,
      outputWrite
    );

    // step3a で広島県府中市と東京都府中市の2つのパターンが検出されたとする
    // でも MockedAddressFinder が東京都府中市のデータしか返さないので、
    // 東京都府中市だけに特定されるはず
    const actualValues = outputWrite.toArray();
    expect(actualValues.length).toBe(1);
    expect(actualValues[0]).toEqual({
      query: Query.create('府中市宮西町2丁目24番地').copy({
        prefecture: PrefectureName.TOKYO,
        city: '府中市',
        tempAddress: '宮西町2丁目24番地',
        match_level: MatchLevel.ADMINISTRATIVE_AREA,
      }),
      callback: dummyCallback,
    });
  });
});
