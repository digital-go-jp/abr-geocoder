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
      {"address":"越後県越後市","regExpPattern":"^越後市","prefectureName":"越後県","cityName":"越後市"},
      {"address":"陸奥県陸奥町","regExpPattern":"^陸奥町","prefectureName":"陸奥県","cityName":"陸奥町"}
    ];
    expect(patterns.length).toBe(expectPatterns.length);
    expect(patterns).toEqual(expectPatterns);
  })
});