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
import { zen2HankakuNum } from '@domain/zen2hankaku-num';
import { describe, expect, it } from '@jest/globals';

describe('zen2hankaku-num', () => {
  const queries = [
    {
      input: '1-2-3',
      expected: '1-2-3'
    },
    {
      input: '１−２−３',
      expected: '1−2−3'
    },
    {
      input: 'ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ',
      expected: 'abcdefghijklmnopqrstuvwxyz'
    },
    {
      input: 'ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ',
      expected: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    },
    {
      input: '東京都　　　 　渋谷区　３丁目０−０−０',
      expected: '東京都　　　 　渋谷区　3丁目0−0−0'
    },
  ];

  queries.forEach(query => {
    it.concurrent(`'${query.input}' should be converted to '${query.expected}'`, async () => {
      expect(
        zen2HankakuNum(query.input),
      ).toBe(
        query.expected,
      );
    })
  })
});
