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
import { InterpolatePattern } from '@domain/interpolate-pattern';
import { IPrefecture } from '@domain/prefecture';
import { toRegexPattern } from './to-regex-pattern';
import { ICity } from '@domain/city';

/**
 * オリジナルコード
 * https://github.com/digital-go-jp/abr-geocoder/blob/a42a079c2e2b9535e5cdd30d009454cddbbca90c/src/engine/lib/cacheRegexes.ts#L104-L125
 */
export const getCityRegexPatterns = ({
  prefecture,
}: {
  prefecture: IPrefecture;
}): InterpolatePattern[] => {
  // 少ない文字数の地名に対してミスマッチしないように文字の長さ順にソート
  return prefecture.cities
    .sort((cityA: ICity, cityB: ICity): number => {
      return cityB.name.length - cityA.name.length;
    })
    .map(city => {
      let pattern = `^${toRegexPattern(city.name)}`;
      if (city.name.match(/(町|村)$/)) {
        pattern = `^${toRegexPattern(city.name).replace(/(.+?)郡/, '($1郡)?')}`; // 郡が省略されてるかも
      }

      return {
        prefecture: prefecture.name,
        regExpPattern: pattern,
        city: city.name,
      };
    });
};
