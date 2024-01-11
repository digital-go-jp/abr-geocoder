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
export enum MatchLevel {
  // 都道府県も判別できなかった
  UNKNOWN = 0,

  // 都道府県まで判別できた
  PREFECTURE = 1,

  // 市区町村まで判別できた
  ADMINISTRATIVE_AREA = 2,

  // 町字まで判別できた
  TOWN_LOCAL = 3,

  // 町字 + 小字まで判別できた
  TOWN_LOCAL_PARTIAL = 4,

  // 住居表示の街区までの判別ができた
  RESIDENTIAL_BLOCK = 7,

  // 住居表示の街区符号・住居番号までの判別ができた
  RESIDENTIAL_DETAIL = 8,
}
