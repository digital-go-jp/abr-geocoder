import {
  IPrefecture,
  PrefectureName,
  SpecialPattern
} from './types';

/**
 * 「福島県石川郡石川町」のように、市の名前が別の都道府県名から始まっているケースのための
 * 正規表現パターンを生成する
 */
export const getSameNamedPrefecturePatterns = ({
  prefPatterns,
  prefectures,
} : {
  prefPatterns: SpecialPattern[],
  prefectures: IPrefecture[]
}) => {

  const buffer: string[] = [];
  for (const [key, value] of Object.entries(PrefectureName)) {
    const prefName = value.replace(/[都道府県]$/, '');
    buffer.push(prefName);
  }
  const prefKanji = Array.from(new Set(buffer.join(''))).join('');
  const firstFilter = new RegExp(`[${prefKanji}]`);
  const regPrefPatterns: [string, RegExp][] = prefPatterns.map((pattern) => {
    return [
      pattern[0], // 都道府県名
      new RegExp(pattern[1]),  // 都道府県名にマッチさせるための正規表現
    ];
  });
  
  const results: SpecialPattern[] = prefectures
    // 都道府県の漢字を含む市町村名のみを抽出する
    .flatMap(prefecture => {
      return prefecture.towns.map(town => {
        if (!firstFilter.test(town.name)) {
          return;
        }
        return({
          townName: town.name,
          prefName: prefecture.todofuken_name,
        });
      });
    })
    // マッチしないデータを排除 
    .filter(x => x !== undefined)
    
    // 都道府県名を市町村名の頭文字から含むものだけを抽出する
    //
    // 例：
    // 「福島県石川郡石川町」 の「石川郡石川町」の部分で「石川」が「石川県」にマッチする
    .map(chunk => {
      for (const pattern of regPrefPatterns) {
        if (!pattern[1].test(chunk!.townName)) {
          continue;
        }

        return [
          `${chunk!.prefName}${chunk!.townName}`,
          `^${chunk!.townName}`
        ];
      }
    })
    // マッチしないデータを排除 
    .filter(x => x !== undefined) as SpecialPattern[];

  return results;
}