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
import { FromStep3aType } from '@domain/from-step3a-type';
import { dummyPrefectures } from '@domain/geocode/__tests__/dummy-prefectures.skip';
import { getCityPatternsForEachPrefecture } from '@domain/geocode/get-city-patterns-for-each-prefecture';
import { MatchLevel } from '@domain/match-level';
import { PrefectureName } from '@domain/prefecture-name';
import { Query } from '@domain/query';
import { describe, expect, it, jest } from '@jest/globals';
import Stream, { TransformCallback } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { GeocodingStep3A } from '../step3a-transform';
import { WritableStreamToArray } from './stream-to-array.skip';

describe('step3a-transform', () => {
  const cityPatternsForEachPrefecture =
    getCityPatternsForEachPrefecture(dummyPrefectures);

  const doTest = async (
    input: Query,
    callback: TransformCallback
  ): Promise<FromStep3aType[]> => {
    const outputWrite = new WritableStreamToArray<FromStep3aType>();
    const fromStep3: FromStep3Type = {
      query: input,
      callback,
    };
    const target = new GeocodingStep3A(cityPatternsForEachPrefecture);
    await pipeline(
      Stream.Readable.from([fromStep3], {
        objectMode: true,
      }),
      target,
      outputWrite
    );
    return outputWrite.toArray();
  };

  it.concurrent('複数の都道府県名にマッチする場合は、step3bに進む', async () => {
    const input = Query.create('府中市宮西町2丁目24番地');
    const results = await doTest(input, jest.fn());

    // 1クエリしかないので length = 1
    expect(results.length).toBe(1);

    // 東京都府中市と広島県府中市にマッチする
    expect(results[0].matchedPatterns).toEqual([
      {
        prefecture: PrefectureName.TOKYO,
        city: '府中市',
        tempAddress: '宮西町2丁目24番地',
      },
      {
        prefecture: PrefectureName.HIROSHIMA,
        city: '府中市',
        tempAddress: '宮西町2丁目24番地',
      },
    ]);
  });

  it.concurrent('複数の広島市にマッチする場合は、step3bに進む', async () => {
    const input = Query.create('広島市佐伯区海老園二丁目5番28号');
    const results = await doTest(input, jest.fn());

    // 1クエリしかないので length = 1
    expect(results.length).toBe(1);

    // 広島市佐伯区 と 広島市 にマッチするはず
    expect(results[0].matchedPatterns).toEqual([
      {
        prefecture: PrefectureName.HIROSHIMA,
        city: '広島市佐伯区',
        tempAddress: '海老園二丁目5番28号',
      },
      {
        prefecture: PrefectureName.HIROSHIMA,
        city: '広島市',
        tempAddress: '佐伯区海老園二丁目5番28号',
      },
    ]);
  });

  it.concurrent('都道府県名に１つだけマッチする場合は step4に進む', async () => {
    // 広島市 にマッチするはず
    const step3finish = jest.fn();
    const results = await doTest(Query.create('八幡市八幡園内75'), step3finish);

    // step3finish が呼ばれているはず
    expect(step3finish).toHaveBeenCalledWith(
      null,
      Query.create('八幡市八幡園内75').copy({
        prefecture: PrefectureName.KYOTO,
        city: '八幡市',
        tempAddress: '八幡園内75',
        match_level: MatchLevel.ADMINISTRATIVE_AREA,
      })
    );
  });
});
