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
import { Prefecture } from '@domain/prefecture';
import { PrefectureName } from '@domain/prefecture-name';
import { describe, expect, it, jest } from '@jest/globals';
import { getCityRegexPatterns } from '../get-city-regex-patterns';

jest.mock('../to-regex-pattern');

describe('getCityRegexPatterns', () => {
  it('should return InterpolatePattern list', async () => {
    const prefecture = new Prefecture({
      name: PrefectureName.OKINAWA,
      cities: [
        {
          name: '八重山郡竹富町',
          lg_code: '473812',
        },
        {
          name: '八重山郡与那国町',
          lg_code: '473821',
        }
      ],
    });

    const results = getCityRegexPatterns({
      prefecture,
    });

    // 文字数が長い順に並び替えるので、与那国町 -> 竹富町 の順になる
    expect(results).toEqual([
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
    ]);
  });
});
