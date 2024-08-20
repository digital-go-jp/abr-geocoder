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

export class MatchLevel {
  private constructor(
    public readonly num: number,
    public readonly str: string,
  ) {
    Object.freeze(this);
  }

  toString(): string {
    return this.str;
  }

  // 何かエラーが発生した
  static readonly ERROR = new MatchLevel(-1, 'error');
  
  // 都道府県も判別できなかった
  static readonly UNKNOWN = new MatchLevel(0, 'unknown');
  // 都道府県まで判別できた
  static readonly PREFECTURE = new MatchLevel(1, 'prefecture');
  // 郡市区町村まで判別できた
  static readonly CITY = new MatchLevel(2, 'city');
  // 大字・町字まで判別できた
  static readonly MACHIAZA = new MatchLevel(3, 'machiaza');
  // 小字まで判別できた
  static readonly MACHIAZA_DETAIL = new MatchLevel(4, 'machiaza_detail');
  
  // 住居表示の街区までの判別ができた
  static readonly RESIDENTIAL_BLOCK = new MatchLevel(5, 'residential_block');
  // 住居表示の街区符号・住居番号までの判別ができた
  static readonly RESIDENTIAL_DETAIL = new MatchLevel(6, 'residential_detail');
  // 地番まで判別ができた
  static readonly PARCEL = new MatchLevel(7, 'parcel');
}
