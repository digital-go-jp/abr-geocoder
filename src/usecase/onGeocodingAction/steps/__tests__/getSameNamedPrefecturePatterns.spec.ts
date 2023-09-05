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
        address: '広島県広島市',
        regExpPattern: '^広島市',
        prefectureName: '広島県',
        cityName: '広島市',
      },
      {
        address: '広島県広島市佐伯区',
        regExpPattern: '^広島市佐伯区',
        prefectureName: '広島県',
        cityName: '広島市佐伯区',
      },
      {
        address: '京都府京都市',
        regExpPattern: '^京都市',
        prefectureName: '京都府',
        cityName: '京都市',
      },
      {
        address: '京都府京都市北区',
        regExpPattern: '^京都市北区',
        prefectureName: '京都府',
        cityName: '京都市北区',
      },
      {
        address: '京都府京都市上京区',
        regExpPattern: '^京都市上京区',
        prefectureName: '京都府',
        cityName: '京都市上京区',
      },
      {
        address: '長崎県長崎市',
        regExpPattern: '^長崎市',
        prefectureName: '長崎県',
        cityName: '長崎市',
      },
      {
        address: '鹿児島県鹿児島市',
        regExpPattern: '^鹿児島市',
        prefectureName: '鹿児島県',
        cityName: '鹿児島市',
      },
      {
        address: '鹿児島県鹿児島郡三島村',
        regExpPattern: '^鹿児島郡三島村',
        prefectureName: '鹿児島県',
        cityName: '鹿児島郡三島村',
      },
      {
        address: '鹿児島県鹿児島郡十島村',
        regExpPattern: '^鹿児島郡十島村',
        prefectureName: '鹿児島県',
        cityName: '鹿児島郡十島村',
      },
      {
        address: '福島県石川郡石川町',
        regExpPattern: '^石川郡石川町',
        prefectureName: '福島県',
        cityName: '石川郡石川町',
      },
      {
        address: '福島県石川郡玉川村',
        regExpPattern: '^石川郡玉川村',
        prefectureName: '福島県',
        cityName: '石川郡玉川村',
      },
      {
        address: '福島県石川郡平田村',
        regExpPattern: '^石川郡平田村',
        prefectureName: '福島県',
        cityName: '石川郡平田村',
      },
      {
        address: '福島県石川郡浅川町',
        regExpPattern: '^石川郡浅川町',
        prefectureName: '福島県',
        cityName: '石川郡浅川町',
      },
      {
        address: '福島県石川郡古殿町',
        regExpPattern: '^石川郡古殿町',
        prefectureName: '福島県',
        cityName: '石川郡古殿町',
      },
    ];
    expect(patterns.length).toBe(expectPatterns.length);
    expect(patterns).toEqual(expectPatterns);
  });
});
