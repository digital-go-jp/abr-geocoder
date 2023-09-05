import { IPrefecture, InterpolatePattern } from './types';

/**
 *  オリジナルコード
 *  https://github.com/digital-go-jp/abr-geocoder/blob/a42a079c2e2b9535e5cdd30d009454cddbbca90c/src/engine/lib/cacheRegexes.ts#L90-L102
 */
export const getPrefectureRegexPatterns = ({
  prefectures,
  wildcardHelper,
}: {
  prefectures: IPrefecture[];
  wildcardHelper: (pattern: string) => string;
}): InterpolatePattern[] => {
  return prefectures.map<InterpolatePattern>(pref => {
    return {
      address: pref.name,
      regExpPattern: wildcardHelper(`^${pref.name}?`),
      prefectureName: pref.name,
    };
  });
};
