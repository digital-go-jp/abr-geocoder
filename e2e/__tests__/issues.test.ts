/*!
 * MIT License
 *
 * Copyright (c) 2024 デジタル庁
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
import { describe, test } from '@jest/globals';
import { jsonTestRunner } from './common';

describe('issues', () => {
  test('#131: ハイフンのゆらぎ', async () => {
    await jsonTestRunner('issue131');
  });

  test('#133: 「地割」が「koaza」に正規化されない', async () => {
    await jsonTestRunner('issue133');
  });

  test('#122: 大字・町なし小字ありのパターンでマッチングできない', async () => {
    await jsonTestRunner('issue122');
  });
  
  test('#123: 同一市区町村のある町字が別の町字に前方一致するパターン', async () => {
    await jsonTestRunner('issue123');
  });

  test('#157: エッジケース：階数を含むケース', async () => {
    await jsonTestRunner('issue157');
  });
  test('#166: 半角カタカナの「ｹ」がマッチしない', async () => {
    await jsonTestRunner('issue166');
  });
  
  test('issue186: 「部」が重複', async () => {
    await jsonTestRunner('issue186');
  });
  
  test('issue187: 「丁」が重複', async () => {
    await jsonTestRunner('issue187');
  });
  
  test('issue188: 「条」が重複', async () => {
    await jsonTestRunner('issue188');
  });
  
  test('issue189: 「丁目」が省略される', async () => {
    await jsonTestRunner('issue189');
  });
});
