import { RegExpEx } from '../../domain';
import { IPrefecture, InterpolatePattern } from './types';

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
  prefectures: IPrefecture[],
  wildcardHelper: (pattern: string) => string;
}): InterpolatePattern[] => {

  const results: InterpolatePattern[] = prefectures
    // 都道府県名を市町村名の頭文字から含むものだけを抽出する
    //
    // 例：
    // 「福島県石川郡石川町」 の「石川郡石川町」の部分で「石川」が「石川県」にマッチする
    .flatMap(pref => {
      const prefectureName = pref.name.replace(RegExpEx.create('[都道府県]$'), '');
      return pref.cities.map<InterpolatePattern | undefined>(city => {
        console.log(`${city.name} : ${prefectureName}`);
        if (!city.name.startsWith(prefectureName)) {
          return;
        }

        return {
          address: `${pref.name}${city.name}`,
          regExpPattern: wildcardHelper(`^${city.name}`),
          prefectureName: pref.name,
          cityName: city.name,
        };
      })
    })
    // マッチしないデータを排除
    .filter(x => x !== undefined) as InterpolatePattern[];

  return results;
};
