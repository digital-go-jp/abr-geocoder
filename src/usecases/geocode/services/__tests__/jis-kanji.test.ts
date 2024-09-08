import { test, expect, describe } from '@jest/globals';
import { jisKanji } from '../jis-kanji';

describe('jisKanji', () => {
  test('愛知県名古屋市榮町', () => {
    const input = '愛知県名古屋市榮町';
    const expectedOutput = '愛知県名古屋市栄町';
    expect(jisKanji(input)).toBe(expectedOutput);
  });

  test('兵庫県神戸市櫻木町', () => {
    const input = '兵庫県神戸市櫻木町';
    const expectedOutput = '兵庫県神戸市桜木町';
    expect(jisKanji(input)).toBe(expectedOutput);
  });

  test('東京都千代田区麹町一丁目', () => {
    const input = '東京都千代田区麹町一丁目';
    const expectedOutput = '東京都千代田区糀町一丁目';
    expect(jisKanji(input)).toBe(expectedOutput);
  });
});
