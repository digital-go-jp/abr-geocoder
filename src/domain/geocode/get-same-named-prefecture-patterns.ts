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
import { PrefectureName } from '@domain/prefecture-name';
import { RegExpEx } from '@domain/reg-exp-ex';

class Trie {
  children = new Map<string, Trie>();
  eow = false;
}
/**
 * 「福島県石川郡石川町」のように、市の名前が別の都道府県名から始まっているケースのための
 * 正規表現パターンを生成する
 *
 * オリジナルコード
 * https://github.com/digital-go-jp/abr-geocoder/blob/a42a079c2e2b9535e5cdd30d009454cddbbca90c/src/engine/lib/cacheRegexes.ts#L320-L350
 */
export const getSameNamedPrefecturePatterns = ({
  prefectures,
  wildcardHelper,
}: {
  prefectures: IPrefecture[];
  wildcardHelper: (pattern: string) => string;
}): InterpolatePattern[] => {
  // 都道府県名のトライ木を作る
  const root = new Trie();
  const removeSymbol = RegExpEx.create('[都道府県]$');
  Object.values(PrefectureName).forEach(prefName => {
    const prefectureName = prefName.replace(removeSymbol, '');

    let parent = root;
    for (const char of [...prefectureName]) {
      if (!parent.children.has(char)) {
        parent.children.set(char, new Trie());
      }
      parent = parent.children.get(char)!;
    }
    parent.eow = true;
  });

  const results: InterpolatePattern[] = [];
  // 都道府県名を市町村名の頭文字から含むものだけを抽出する
  //
  // 例：
  // 「福島県石川郡石川町」 の「石川郡石川町」の部分で「石川」が「石川県」にマッチする
  prefectures.forEach(pref => {
    pref.cities.forEach(city => {
      let parent = root;
      for (const char of [...city.name]) {
        if (!parent.children.has(char)) {
          return;
        }
        parent = parent.children.get(char)!;
        if (parent.eow) {
          break;
        }
      }

      results.push({
        regExpPattern: wildcardHelper(`^${city.name}`),
        prefecture: pref.name,
        city: city.name,
      });
    });
  });

  return results;
};
