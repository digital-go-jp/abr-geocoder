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
import { InterpolatePattern } from '@domain/interpolate-pattern';
import { MatchLevel } from '@domain/match-level';
import { PrefectureName } from '@domain/prefecture-name';
import { Query } from '@domain/query';
import { describe, expect, it } from '@jest/globals';
import Stream from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { GeocodingStep4 } from '../step4-transform';
import { WritableStreamToArray } from './stream-to-array.skip';

describe('step4-transform', () => {

  // Comes from getCityPatternsForEachPrefecture.spec.ts
  const cityPatternsForEachPrefecture = new Map<PrefectureName, InterpolatePattern[]>([
    [PrefectureName.OKINAWA, [
      {
        prefecture: PrefectureName.OKINAWA,
        regExpPattern: '^(八重山郡)?与那国町',
        city: '八重山郡与那国町',
      },
      {
        prefecture: PrefectureName.OKINAWA,
        regExpPattern: '^(八重山郡)?竹富町',
        city: '八重山郡竹富町',
      },
    ]],

    [PrefectureName.HOKKAIDO, [
      {
        prefecture: PrefectureName.HOKKAIDO,
        regExpPattern: '^札幌市中央区',
        city: '札幌市中央区',
      },
      {
        prefecture: PrefectureName.HOKKAIDO,
        regExpPattern: '^札幌市',
        city: '札幌市',
      },
    ]]
  ]);

  it.concurrent('都道府県が不明 or 市町村名がすでに判明している場合はスキップ', async () => {
    const dummyData1 = Query.create('どこか');
    const dummyData2 = Query.create('沖縄県八重山郡竹富町').copy({
      prefecture: PrefectureName.OKINAWA,
      city: '八重山郡竹富町',
    });

    const outputWrite = new WritableStreamToArray<Query>();

    const target = new GeocodingStep4({
      cityPatternsForEachPrefecture,
      wildcardHelper: (txt: string) => txt,
    });
    
    await pipeline(
      Stream.Readable.from([
        dummyData1,
        dummyData2,
      ], {
        objectMode: true,
      }),
      target,
      outputWrite
    );

    const reuslts = outputWrite.toArray();
    expect(reuslts).toEqual([
      dummyData1,
      dummyData2,
    ]);
  });

  it.concurrent('都道府県 or 市町村名がわからない場合', async () => {
    const dummyData1 = Query.create('竹富町のどこか').copy({
      prefecture: PrefectureName.OKINAWA,
    });
    const dummyData2 = Query.create('札幌市中央区のどこか').copy({
      prefecture: PrefectureName.HOKKAIDO,
    });
    const dummyData3 = Query.create('どこかわからない場所').copy({
      prefecture: PrefectureName.HOKKAIDO,
    });

    const outputWrite = new WritableStreamToArray<Query>();

    const target = new GeocodingStep4({
      cityPatternsForEachPrefecture,
      wildcardHelper: (txt: string) => txt,
    });
    await pipeline(
      Stream.Readable.from([
        dummyData1,
        dummyData2,
        dummyData3,
      ], {
        objectMode: true,
      }),
      target,
      outputWrite
    );

    const reuslts = outputWrite.toArray();
    expect(reuslts).toEqual([
      dummyData1.copy({
        city: '八重山郡竹富町',
        match_level: MatchLevel.ADMINISTRATIVE_AREA,
        tempAddress: 'のどこか', // 判定できなかった残り部分
      }),

      dummyData2.copy({
        city: '札幌市中央区',
        match_level: MatchLevel.ADMINISTRATIVE_AREA,
        tempAddress: 'のどこか', // 判定できなかった残り部分
      }),

      // 不明な場所はそのまま
      dummyData3,
    ]);
  });
});
