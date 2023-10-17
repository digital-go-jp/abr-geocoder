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
import { Query } from '@domain/query';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { DASH } from '@settings/constant-values';
import Stream from 'node:stream';
import { GeocodingStep1 } from '../step1-transform';
import { WritableStreamToArray } from './stream-to-array.skip';

describe('step1-transform', () => {
  const target = new GeocodingStep1();
  const outputWrite = new WritableStreamToArray<Query>();

  beforeEach(() => {
    outputWrite.reset();
  });

  it('全角英数字・全角スペースを半角にする', async () => {
    const source = Stream.Readable.from(
      [
        Query.create('1-2-3'),
        Query.create('１−２−３'),
        Query.create('ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ'),
        Query.create('ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ'),
        Query.create('東京都　　　 　渋谷区　３丁目０−０−０'),
      ],
      {
        objectMode: true,
      }
    );

    await Stream.promises.pipeline(source, target, outputWrite);

    const actualValues = outputWrite.toArray();
    const expectValues = [
      ['1', DASH, '2', DASH, '3'].join(''),
      ['1', DASH, '2', DASH, '3'].join(''),
      'abcdefghijklmnopqrstuvwxyz',
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      ['東京都渋谷区3丁目0',DASH,'0',DASH,'0'].join(''),
    ];
    expect(expectValues.length).toBe(actualValues.length);
    expectValues.forEach((expectVal, i) => {
      expect(actualValues[i].tempAddress).toBe(expectVal);
    });
  });
});
