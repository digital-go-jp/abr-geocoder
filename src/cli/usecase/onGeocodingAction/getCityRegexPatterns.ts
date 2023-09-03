import { IPrefecture, ICity, InterpolatePattern, Prefecture, PrefectureName } from './types';
import { toRegexPattern } from './toRegexPattern';
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
  return prefecture.cities.sort((cityA: ICity, cityB: ICity): number => {
    return cityB.name.length - cityA.name.length;
  })
  .map(city => {
    let pattern = `^${toRegexPattern(city.name)}`
    if (city.name.match(/(町|村)$/)) {
      pattern = `^${toRegexPattern(city.name).replace(/(.+?)郡/, '($1郡)?')}` // 郡が省略されてるかも
    }

    return {
      prefectureName: prefecture.name,
      regExpPattern: pattern,
      address: `${prefecture.name}${city.name}`,
      cityName: city.name,
    }
  });
}