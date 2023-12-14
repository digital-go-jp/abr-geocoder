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
import { jisKanji } from '../jis-kanji';
import oldKanji_to_newKanji_table from '@settings/jis-kanji-table';

describe('JisKanji', () => {

  it('should replace old Chinese characters(aka. Kanji) with new characters', async () => {
    const buf1: string[] = [];
    const buf2: string[] = [];
    for (const [oldChar, newChar] of Object.entries(oldKanji_to_newKanji_table)) {
      buf1.push(oldChar);
      buf2.push(`(${oldChar}|${newChar})`);
    }
    const input = buf1.join('');
    const expectedResult = buf2.join('');
    const result = jisKanji(input);
    expect(result).toEqual(expectedResult);
  });

});
