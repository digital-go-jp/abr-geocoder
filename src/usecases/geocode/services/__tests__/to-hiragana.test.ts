import {test, expect, describe} from '@jest/globals';
import {toHiragana} from '../to-hiragana';

// 文字列変換のテストケース
describe('toHiragana', () => {
  test('カタカナの住所を平仮名に変換する', () => {
    expect(toHiragana('カワサキシ')).toBe('かわさきし');
  });

  test('半角カタカナの住所を平仮名に変換する', () => {
    expect(toHiragana('ｶﾝｻﾞｷﾋﾞﾙ')).toBe('かんざきびる');
  });

  test('拗音を含む住所を平仮名に変換する', () => {
    expect(toHiragana('ヨコハマチョウ')).toBe('よこはまちょう');
  });

  test('濁音を含む住所を平仮名に変換する', () => {
    expect(toHiragana('ドウゾウカ')).toBe('どうぞうか');
  });

  test('半角カタカナと全角カタカナの混在を平仮名に変換する', () => {
    expect(toHiragana('ﾄｳｷｮｳﾄﾁﾖﾀﾞｸ')).toBe('とうきょうとちよだく');
  });

  test('特殊なカタカナの住所を平仮名に変換する', () => {
    expect(toHiragana('アサヒガオカ')).toBe('あさひがおか');
  });

  test('数字や記号が含まれる住所を平仮名に変換する', () => {
    expect(toHiragana('オオサカシミナミ3-5-1')).toBe('おおさかしみなみ3-5-1');
  });

  test('空文字の処理を確認する', () => {
    expect(toHiragana('')).toBe('');
  });
});
