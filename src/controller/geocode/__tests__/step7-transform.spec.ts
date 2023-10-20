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
import { AddressFinderForStep7 } from '@domain/geocode/__mocks__/address-finder-for-step7';
import { PrefectureName } from '@domain/prefecture-name';
import { Query } from '@domain/query';
import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import Stream from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { GeocodingStep7 } from '../step7-transform';
import { WritableStreamToArray } from './stream-to-array.skip';

jest.mock('@domain/geocode/address-finder-for-step7');

describe('step7-transform', () => {
  const outputWrite = new WritableStreamToArray<Query>();
  const source = [
    Query.create('東京都千代田区紀尾井町どこか').copy({
      prefecture: PrefectureName.TOKYO,
      city: '千代田区',
      town: '紀尾井町',
      tempAddress: 'どこか'
    }),

    Query.create('東京都どこか').copy({
      prefecture: PrefectureName.TOKYO,
      tempAddress: 'どこか'
    }),
  ];

  const finder = new AddressFinderForStep7();
  const target = new GeocodingStep7(finder);

  beforeAll(async () => {
    await pipeline(
      Stream.Readable.from(source, {
        objectMode: true,
      }),
      target,
      outputWrite
    );
  })

  it('addressFinder.find()から正常に返されるケース', async () => {
    const results = outputWrite.toArray();
    expect(results.length).toBe(source.length);
    expect(results[0]).toEqual(source[0]);
    expect(finder.find).toBeCalledWith(source[0]);
  });
  it('townがないので、スキップするケース', async () => {
    const results = outputWrite.toArray();
    expect(results.length).toBe(source.length);
    expect(results[1]).toEqual(source[1]);
    expect(finder.find).not.toBeCalledWith(source[1]);
  });
});
