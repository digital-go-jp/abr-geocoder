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
import { describe, expect, it } from '@jest/globals';
import { Stream } from 'node:stream';
import { JsonTransform } from '../json-transform';
import { BREAK_AT_EOF } from '@settings/constant-values';
import { expectResult, expectResults } from './data/expect-results';
import { testValues } from './data/test-values';

describe('JsonTransform', () => {
  it('should output rows with expected JSON format()', async () => {
    const transform = JsonTransform.create();

    // クエリ毎に結果を results に溜めていく
    const buffer: string[] = [];
    const writable = new Stream.Writable({
      objectMode: true,
      write(chunk, encoding, callback) {
        buffer.push(chunk.toString());
        callback();
      },
    })
    const readStream = Stream.Readable.from(testValues);

    await Stream.promises.pipeline(
      readStream,
      transform,
      writable,
    )

    // 最後の空行は排除
    expect(buffer.at(-1)).toEqual(BREAK_AT_EOF);
    buffer.pop();

    const results = JSON.parse(buffer.join('')) as expectResult[];

    expect(results.length).toBe(expectResults.length);

    // 1オブジェクト単位で比較
    for (let i = 0; i < results.length; i++) {
      expect(results[i]).toEqual(expectResults[i]);
    }
  });
});
