import { describe, expect, it } from '@jest/globals';
import { PrefectureName, getPrefectureRegexPatterns } from '../..';
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
