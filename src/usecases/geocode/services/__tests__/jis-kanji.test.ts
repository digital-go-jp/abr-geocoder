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
});
