import { describe, expect, it } from '@jest/globals';
import { getSameNamedPrefecturePatterns } from '../../getSameNamedPrefecturePatterns';
import { dummyPrefectures } from './dummyPrefectures';

describe('getSameNamedPrefecturePatterns', () => {
  it('都道府県名と同じ名前の市区町村を検出するためのパターンを生成する', () => {
    // ダミーの都道府県と市区町村名でテスト
    const patterns = getSameNamedPrefecturePatterns({
      prefectures: dummyPrefectures,
      wildcardHelper: (address: string) => address,
    });

    const expectPatterns = [
      {
        regExpPattern: '^広島市',
        prefecture: '広島県',
        city: '広島市',
      },
      {
        regExpPattern: '^広島市佐伯区',
        prefecture: '広島県',
        city: '広島市佐伯区',
      },
      {
        regExpPattern: '^京都市',
        prefecture: '京都府',
        city: '京都市',
      },
      {
        regExpPattern: '^京都市北区',
        prefecture: '京都府',
        city: '京都市北区',
      },
      {
        regExpPattern: '^京都市上京区',
        prefecture: '京都府',
        city: '京都市上京区',
      },
      {
        regExpPattern: '^長崎市',
        prefecture: '長崎県',
        city: '長崎市',
      },
      {
        regExpPattern: '^鹿児島市',
        prefecture: '鹿児島県',
        city: '鹿児島市',
      },
      {
        regExpPattern: '^鹿児島郡三島村',
        prefecture: '鹿児島県',
        city: '鹿児島郡三島村',
      },
      {
        regExpPattern: '^鹿児島郡十島村',
        prefecture: '鹿児島県',
        city: '鹿児島郡十島村',
      },
      {
        regExpPattern: '^石川郡石川町',
        prefecture: '福島県',
        city: '石川郡石川町',
      },
      {
        regExpPattern: '^石川郡玉川村',
        prefecture: '福島県',
        city: '石川郡玉川村',
      },
      {
        regExpPattern: '^石川郡平田村',
        prefecture: '福島県',
        city: '石川郡平田村',
      },
      {
        regExpPattern: '^石川郡浅川町',
        prefecture: '福島県',
        city: '石川郡浅川町',
      },
      {
        regExpPattern: '^石川郡古殿町',
        prefecture: '福島県',
        city: '石川郡古殿町',
      },
    ];
    expect(patterns.length).toBe(expectPatterns.length);
    expect(patterns).toEqual(expectPatterns);
  });
});
