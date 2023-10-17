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
import { IAddressPatch } from '@domain/iaddress-patch';
import { PrefectureName } from '@domain/prefecture-name';
import { Query } from '@domain/query';
import { describe, expect, it } from '@jest/globals';
import Stream from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { GeocodingStep6 } from '../step6-transform';
import { WritableStreamToArray } from './stream-to-array.skip';

const createWriteStream = () => {
  return new WritableStreamToArray<Query>();
};

const createTestTarget = () => {
  const patchPatterns: IAddressPatch[] = [
    {
      prefecture: PrefectureName.TOKYO,
      city: '千代田区',
      town: '紀尾井町',
      regExpPattern: '^デジ(?:タル)?庁',
      result: '1-3 東京ガーデンテラス紀尾井町 19階、20階',
    },
  ];
  return new GeocodingStep6(patchPatterns);
}

describe('step6-transform', () => {

  it.concurrent('不完全な住所を正規表現で補正する', async () => {
    const dummyData1 = Query.create('東京都千代田区紀尾井町デジ庁').copy({
      prefecture: PrefectureName.TOKYO,
      city: '千代田区',
      town: '紀尾井町',
      lg_code: '131016',
      town_id: '0056000',
      tempAddress: 'デジ庁'
    });
    const outputWrite = createWriteStream();
    const target = createTestTarget();
    
    await pipeline(
      Stream.Readable.from([
        dummyData1,
      ], {
        objectMode: true,
      }),
      target,
      outputWrite
    );

    const results = outputWrite.toArray();
    expect(results.length).toBe(1);
    expect(results[0]).toEqual(Query.create('東京都千代田区紀尾井町デジ庁').copy({
      prefecture: PrefectureName.TOKYO,
      city: '千代田区',
      town: '紀尾井町',
      lg_code: '131016',
      town_id: '0056000',
      tempAddress: '1-3 東京ガーデンテラス紀尾井町 19階、20階'
    }));
  });
});
