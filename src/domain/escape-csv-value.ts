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

import { DOUBLE_QUOTATION } from '@settings/constant-values';

export const escapeCsvValue = (value: string): string => {
  const hasCommma = value.includes(',');
  const hasDoubleQuote = value.includes(DOUBLE_QUOTATION);
  const hasLineBreak = value.includes('\n');

  // ダブルクォーテーションが含まれる場合、CSVでは2回連続させる
  if (hasDoubleQuote) {
    const buffer: string[] = [];
    for (const char of value) {
      if (char === DOUBLE_QUOTATION) {
        buffer.push(DOUBLE_QUOTATION);
      }
      buffer.push(char);
    }
    value = buffer.join('');
  }
  if (hasCommma || hasDoubleQuote || hasLineBreak) {
    value = `"${value}"`;
  }
  return value;
};
