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
import { getSameNamedPrefecturePatterns } from '../get-same-named-prefecture-patterns';
import { dummyPrefectures } from './dummy-prefectures.skip';

describe('getSameNamedPrefecturePatterns', () => {
  it('都道府県名と同じ名前の市区町村を検出するためのパターンを生成する', () => {
    // ダミーの都道府県と市区町村名でテスト
    const patterns = getSameNamedPrefecturePatterns({
      prefectures: dummyPrefectures,
      wildcardHelper: (address: string) => address,
    });

    const expectPatterns = [
      {
        regExpPattern: '^広島市',
        prefecture: '広島県',
        city: '広島市',
      },
      {
        regExpPattern: '^広島市佐伯区',
        prefecture: '広島県',
        city: '広島市佐伯区',
      },
      {
        regExpPattern: '^京都市',
        prefecture: '京都府',
        city: '京都市',
      },
      {
        regExpPattern: '^京都市北区',
        prefecture: '京都府',
        city: '京都市北区',
      },
      {
        regExpPattern: '^京都市上京区',
        prefecture: '京都府',
        city: '京都市上京区',
      },
      {
        regExpPattern: '^長崎市',
        prefecture: '長崎県',
        city: '長崎市',
      },
      {
        regExpPattern: '^鹿児島市',
        prefecture: '鹿児島県',
        city: '鹿児島市',
      },
      {
        regExpPattern: '^鹿児島郡三島村',
        prefecture: '鹿児島県',
        city: '鹿児島郡三島村',
      },
      {
        regExpPattern: '^鹿児島郡十島村',
        prefecture: '鹿児島県',
        city: '鹿児島郡十島村',
      },
      {
        regExpPattern: '^石川郡石川町',
        prefecture: '福島県',
        city: '石川郡石川町',
      },
      {
        regExpPattern: '^石川郡玉川村',
        prefecture: '福島県',
        city: '石川郡玉川村',
      },
      {
        regExpPattern: '^石川郡平田村',
        prefecture: '福島県',
        city: '石川郡平田村',
      },
      {
        regExpPattern: '^石川郡浅川町',
        prefecture: '福島県',
        city: '石川郡浅川町',
      },
      {
        regExpPattern: '^石川郡古殿町',
        prefecture: '福島県',
        city: '石川郡古殿町',
      },
    ];
    expect(patterns.length).toBe(expectPatterns.length);
    expect(patterns).toEqual(expectPatterns);
  });
});
