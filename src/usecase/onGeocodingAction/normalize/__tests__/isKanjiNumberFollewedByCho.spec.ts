import { describe, expect, it } from '@jest/globals';
import { isKanjiNumberFollewedByCho } from '../../isKanjiNumberFollewedByCho';

describe('isKanjiNumberFollewedByCho', () => {
  it('trueを返すケース', () => {
    // 十六町 のように漢数字と町が連結している
    expect(
      isKanjiNumberFollewedByCho('名古屋市瑞穂区十六町1丁目1'),
    ).toBe(true);

    expect(
      isKanjiNumberFollewedByCho('愛知県名古屋市瑞穂区十六町2丁目1'),
    ).toBe(true);

    expect(
      isKanjiNumberFollewedByCho('岐阜県大垣市十六町1番地'),
    ).toBe(true);

    expect(
      isKanjiNumberFollewedByCho('岐阜県安八郡安八町1-1-1'),
    ).toBe(true);
    expect(
      isKanjiNumberFollewedByCho('高知県	高岡郡	四万十町1-1-1'),
    ).toBe(true);
  });

  it('falseを返すケース', () => {
    // 16町 のように漢数字と町が連結していない
    expect(
      isKanjiNumberFollewedByCho('16町'),
    ).toBe(false);

    // 「町」の前に漢数字がない
    expect(
      isKanjiNumberFollewedByCho('十日町市'),
    ).toBe(false);
    
    // そもそも「町」が含まれていない
    expect(
      isKanjiNumberFollewedByCho('どこか'),
    ).toBe(false);
  });
});