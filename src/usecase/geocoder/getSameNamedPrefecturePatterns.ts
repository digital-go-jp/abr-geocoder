import {
  IPrefecture,
  InterpolatePattern,
  PrefectureName,
  RegExpEx,
} from '../../domain';

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
