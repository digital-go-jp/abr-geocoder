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
import { PrefectureName } from '@domain/prefecture-name';
import { Query } from '@domain/query';
import { describe, expect, it, jest } from '@jest/globals';
import Stream from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { GeocodingStep3 } from '../step3-transform';
import { WritableStreamToArray } from './stream-to-array.skip';

describe('step3transform', () => {
  it.concurrent('都道府県名が判別出来ていない場合は、step3aに続くstreamを呼び出す', async () => {
    const dummyData = Query.create('千葉市どこか');
    const dummyStream = new Stream.Readable({
      objectMode: true,
    });
    const pushMethod = jest.spyOn(dummyStream, 'push');
    pushMethod.mockImplementation((chunk: FromStep3Type | null) => {
      // streamを進める必要があるので、callbackは実行しておく
      chunk?.callback();
      return true;
    });
    const target = new GeocodingStep3(dummyStream);
    const outputWrite = new WritableStreamToArray<Query>();

    await pipeline(
      Stream.Readable.from([dummyData], {
        objectMode: true,
      }),
      target,
      outputWrite
    );

    // 都道府県名が判別出来ているので、step3a に続く
    // stream のpushが「呼び出されている」ことを確認
    expect(pushMethod).toHaveBeenCalledTimes(1);
  });

  it.concurrent('都道府県名が判別出来ている場合はスキップする', async () => {
    const dummyData = Query.create('千葉市どこか').copy({
      prefecture: PrefectureName.CHIBA,
    });

    const dummyStream = new Stream.Readable({
      objectMode: true,
    });
    const pushMethod = jest.spyOn(dummyStream, 'push');

    const target = new GeocodingStep3(dummyStream);
    const outputWrite = new WritableStreamToArray<Query>();

    await pipeline(
      Stream.Readable.from([dummyData], {
        objectMode: true,
      }),
      target,
      outputWrite
    );

    // 都道府県名が判別出来ているので、step3a に続く
    // stream のpushが「呼び出されていない」ことを確認
    expect(pushMethod).toHaveBeenCalledTimes(0);

    // step3の結果として、入力値と同じものが返ってくることを確認
    const actualValues = outputWrite.toArray();
    expect(actualValues.length).toBe(1);
    expect(actualValues[0]).toEqual(dummyData);
  });
});
