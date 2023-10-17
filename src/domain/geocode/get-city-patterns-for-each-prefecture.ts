import { IPrefecture, InterpolatePattern, PrefectureName } from '@domain';
import { getCityRegexPatterns } from './get-city-regex-patterns';

export const getCityPatternsForEachPrefecture = (
  prefectures: IPrefecture[]
): Map<PrefectureName, InterpolatePattern[]> => {
  const result = new Map<PrefectureName, InterpolatePattern[]>();

  prefectures.forEach(prefecture => {
    result.set(
      prefecture.name,
      getCityRegexPatterns({
        prefecture,
      })
    );
  });
  return result;
};
