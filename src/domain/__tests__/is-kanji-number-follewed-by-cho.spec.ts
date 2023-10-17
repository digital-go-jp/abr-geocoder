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
import { isKanjiNumberFollewedByCho } from '../is-kanji-number-follewed-by-cho';

describe('isKanjiNumberFollewedByCho', () => {
  it.concurrent('trueを返すケース', async () => {
    // 十六町 のように漢数字と町が連結している
    expect(isKanjiNumberFollewedByCho('名古屋市瑞穂区十六町1丁目1')).toBe(true);

    expect(isKanjiNumberFollewedByCho('愛知県名古屋市瑞穂区十六町2丁目1')).toBe(
      true
    );

    expect(isKanjiNumberFollewedByCho('岐阜県大垣市十六町1番地')).toBe(true);

    expect(isKanjiNumberFollewedByCho('岐阜県安八郡安八町1-1-1')).toBe(true);
    expect(isKanjiNumberFollewedByCho('高知県	高岡郡	四万十町1-1-1')).toBe(true);
  });

  it.concurrent('falseを返すケース', async () => {
    // 16町 のように漢数字と町が連結していない
    expect(isKanjiNumberFollewedByCho('16町')).toBe(false);

    // 「町」の前に漢数字がない
    expect(isKanjiNumberFollewedByCho('十日町市')).toBe(false);

    // そもそも「町」が含まれていない
    expect(isKanjiNumberFollewedByCho('どこか')).toBe(false);
  });
});
