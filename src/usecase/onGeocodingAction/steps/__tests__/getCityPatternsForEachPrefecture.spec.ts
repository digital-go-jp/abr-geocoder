import { describe, expect, it } from '@jest/globals';
import { getCityPatternsForEachPrefecture } from '../../getCityPatternsForEachPrefecture';
import { dummyPrefectures } from './dummyPrefectures';
import { PrefectureName, InterpolatePattern } from '../../types';

describe('getCityPatternsForEachPrefecture', () => {
  it('都道府県ごとに市町村名にマッチする正規表現パターンを作成する', () => {
    // 数が多いとコードの可読性が落ちるので、東京都と京都府だけに限定して比較
    const reducedPrefectures = dummyPrefectures.filter(pref => {
      return (
        pref.name === PrefectureName.TOKYO || pref.name === PrefectureName.KYOTO
      );
    });
    const patterns = getCityPatternsForEachPrefecture(reducedPrefectures);

    // 期待値
    const expectPatterns = new Map<PrefectureName, InterpolatePattern[]>();
    expectPatterns.set(PrefectureName.TOKYO, [
      {
        address: '東京都西多摩郡奥多摩町',
        city: '西多摩郡奥多摩町',
        prefecture: PrefectureName.TOKYO,
        regExpPattern: '^(西多摩郡)?(奧|奥)多摩町',
      },
      {
        address: '東京都千代田区',
        city: '千代田区',
        prefecture: PrefectureName.TOKYO,
        regExpPattern: '^千代田(區|区)',
      },
      {
        address: '東京都小笠原村',
        city: '小笠原村',
        prefecture: PrefectureName.TOKYO,
        regExpPattern: '^小笠原村',
      },
      {
        address: '東京都町田市',
        city: '町田市',
        prefecture: PrefectureName.TOKYO,
        regExpPattern: '^町田(市|巿)',
      },
      {
        address: '東京都府中市',
        city: '府中市',
        prefecture: PrefectureName.TOKYO,
        regExpPattern: '^府中(市|巿)',
      },
      {
        address: '東京都八丈町',
        city: '八丈町',
        prefecture: PrefectureName.TOKYO,
        regExpPattern: '^[ハ八]丈町',
      },
    ]);
    expectPatterns.set(PrefectureName.KYOTO, [
      {
        address: '京都府相楽郡南山城村',
        city: '相楽郡南山城村',
        prefecture: PrefectureName.KYOTO,
        regExpPattern: '^(相(樂|楽)郡)?南山城村',
      },
      {
        address: '京都府京都市上京区',
        city: '京都市上京区',
        prefecture: PrefectureName.KYOTO,
        regExpPattern: '^京都(市|巿)上京(區|区)',
      },
      {
        address: '京都府相楽郡精華町',
        city: '相楽郡精華町',
        prefecture: PrefectureName.KYOTO,
        regExpPattern: '^(相(樂|楽)郡)?精華町',
      },
      {
        address: '京都府京都市北区',
        city: '京都市北区',
        prefecture: PrefectureName.KYOTO,
        regExpPattern: '^京都(市|巿)北(區|区)',
      },
      {
        address: '京都府京都市',
        city: '京都市',
        prefecture: PrefectureName.KYOTO,
        regExpPattern: '^京都(市|巿)',
      },
      {
        address: '京都府八幡市',
        city: '八幡市',
        prefecture: PrefectureName.KYOTO,
        regExpPattern: '^[ハ八]幡(市|巿)',
      },
    ]);
    expect(patterns).toEqual(expectPatterns);
  });
});
