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
import { PrefectureName } from '@domain/prefecture-name';
import { describe, expect, it } from '@jest/globals';
import { getPrefectureRegexPatterns } from '../get-prefecture-regex-patterns';
import { dummyPrefectures } from './dummy-prefectures.skip';

describe('getPrefectureRegexPatterns', () => {
  it('都道府県名にマッチする正規表現パターンを作成する', () => {
    // 数が多いとコードの可読性が落ちるので、東京都、京都府、北海道、広島県だけに限定して比較
    // (dummyPrefectures内に定義されている都道府県名から選ぶ)
    const reducedPrefectures = dummyPrefectures.filter(pref => {
      return (
        pref.name === PrefectureName.TOKYO ||
        pref.name === PrefectureName.KYOTO ||
        pref.name === PrefectureName.HOKKAIDO ||
        pref.name === PrefectureName.HIROSHIMA
      );
    });
    const patterns = getPrefectureRegexPatterns({
      prefectures: reducedPrefectures,
      wildcardHelper: (address: string) => address,
    });

    // 期待値と戻り値を同じように比較するために、並び替える
    const comp = (a: { prefecture: string; regExpPattern: string; }, b: { prefecture: string; regExpPattern: string; }): number => {
      return a.prefecture.charCodeAt(0) - b.prefecture.charCodeAt(0);
    };

    // 期待値
    expect(patterns.sort(comp)).toEqual(
      [
        {
          prefecture: PrefectureName.TOKYO,
          regExpPattern: '^東京都?',
        },
        {
          prefecture: PrefectureName.HOKKAIDO,
          regExpPattern: '^北海道?',
        },
        {
          prefecture: PrefectureName.HIROSHIMA,
          regExpPattern: '^広島県?',
        },
        {
          prefecture: PrefectureName.KYOTO,
          regExpPattern: '^京都府?',
        },
      ].sort(comp)
    );
  });
});
