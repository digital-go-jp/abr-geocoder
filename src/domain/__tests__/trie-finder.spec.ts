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
import { TrieFinder } from '@domain/trie-finder';
import { beforeAll, describe, expect, it } from '@jest/globals';

const trieFinder = new TrieFinder<string>({
  fuzzy: '?',
  rows: [
    "東京都千代田区紀尾井町1丁目",
    "東京都千代田区紀尾井町1丁目1",
    "東京都千代田区紀尾井町1丁目2",
    "東京都千代田区紀尾井町1丁目3",
    "東京都千代田区紀尾井町1丁目4",
    "東京都千代田区紀尾井町1丁目5",
    "東京都千代田区紀尾井町1丁目6",
    "東京都千代田区紀尾井町1丁目7",
  ],
  preprocessor: (row: string) => row,
});

describe('TrieFinder', () => {

  it.concurrent('should find "東京都千代田区紀尾井町1丁目3"', async () => {
    const result = trieFinder.find({
      target: '東京都千代田区紀尾井町1丁目3',
    })
    expect(result?.info).toEqual('東京都千代田区紀尾井町1丁目3');
  });
  it.concurrent('should find "1234" for unmatched', async () => {
    const result = trieFinder.find({
      target: '東京都千代田区紀尾井町1丁目1234',
    })
    expect(result?.unmatched).toEqual('1234');
  });

  it.concurrent('should return undefined for "東京都千代田区"', async () => {
    const result = trieFinder.find({
      target: '東京都千代田区',
    })
    expect(result?.info).toEqual(undefined);
  });
  it.concurrent('should return "東京都千代田区紀尾井町1丁目3"', async () => {
    const result = trieFinder.find({
      target: '東京都千?田区紀?井町?丁目3',
    })
    expect(result?.info).toEqual('東京都千代田区紀尾井町1丁目3');
  });
});
