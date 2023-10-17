import { InterpolatePattern } from '@domain/interpolate-pattern';
import { IPrefecture } from '@domain/prefecture';
import { PrefectureName } from '@domain/prefecture-name';
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
