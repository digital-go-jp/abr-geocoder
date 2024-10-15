import { describe, expect, test } from "@jest/globals";
import { toHiragana } from "../to-hiragana";

describe("toHiragana", () => {
  test("should not change general Hiragana", () => {
    const result = toHiragana("あいうえお");
    expect(result).toBe("あいうえお");
  });
  test("should not change general Kanji", () => {
    const result = toHiragana("あいう漢字えお");
    expect(result).toBe("あいう漢字えお");
  });
  test("should not change number", () => {
    const result = toHiragana("あいう123えお");
    expect(result).toBe("あいう123えお");
  });
  test("should not change alphabet", () => {
    const result = toHiragana("あいうabcdeえお");
    expect(result).toBe("あいうabcdeえお");
  });
  test("should convert general Katakana to Hiragana", () => {
    const result = toHiragana("アイウエオ");
    expect(result).toBe("あいうえお");
  });
  test("should convert Katakana with voiced sound mark to Hiragana", () => {
    // 「ガ」「ゲ」は「け」に統一する
    const result = toHiragana("ガギグゲゴ");
    expect(result).toBe("けぎぐけご");
  });
  test("should convert Katakana with semi-voiced sound mark to Hiragana", () => {
    const result = toHiragana("パピプペポ");
    expect(result).toBe("ぱぴぷぺぽ");
  });
  test("should convert Katakana to half-width Hiragana", () => {
    // 「ｶ」は「け」に統一する
    const result = toHiragana("あいうﾊﾝｶｸえお");
    expect(result).toBe("あいうはんけくえお");
  });
  
  test("should convert half-width Katakana with voiced sound mark to Hiragana and half-width voiced sound mark", () => {
    const result = toHiragana("ｶﾞｷﾞｸﾞｹﾞｺﾞ");
    expect(result).toBe("けぎぐけご");
  });
  test("should convert 'カ' to 'け' (for 竜ケ崎, 竜カ崎, 八ケ岳, etc.)", () => {
    const result = toHiragana("カキクケコ");
    expect(result).toBe("けきくけこ");
  });
  test("should convert 'ゑ' to 'え', 'ヱ' to 'え', and '之' to 'の'", () => {
    const result = toHiragana("ゑヱ之");
    expect(result).toBe("ええの");
  });
  test("should convert 'ょ' to 'よ', 'ョ' to 'よ', and 'ｮ' to 'よ'", () => {
    const result = toHiragana("きょうキョウｷｮｳ");
    expect(result).toBe("きようきようきよう");
  });

  test('カタカナの住所を平仮名に変換する', () => {
    // 「カ」「ケ」は「ケ」に変換される
    expect(toHiragana('カワサキシ')).toBe('けわさきし');
  });

  test('半角カタカナの住所を平仮名に変換する', () => {
    // 「カ」「ケ」は「ケ」に変換される
    expect(toHiragana('ｶﾝｻﾞｷﾋﾞﾙ')).toBe('けんざきびる');
  });

  test('拗音を含む住所を平仮名に変換する', () => {
    // 「ょ」は「よ」に変換される
    expect(toHiragana('ヨコハマチョウ')).toBe('よこはまちよう');
  });

  test('濁音を含む住所を平仮名に変換する', () => {
    // 「カ」「ケ」は「ケ」に変換される
    expect(toHiragana('ドウゾウカ')).toBe('どうぞうけ');
  });

  test('半角カタカナと全角カタカナの混在を平仮名に変換する', () => {
    // 「ょ」は「よ」に変換される
    expect(toHiragana('ﾄｳｷｮｳﾄﾁﾖﾀﾞｸ')).toBe('とうきようとちよだく');
  });

  test('特殊なカタカナの住所を平仮名に変換する', () => {
    // 「ガ」「ゲ」は「け」に変換される
    expect(toHiragana('アサヒガオカ')).toBe('あさひけおけ');
  });

  test('数字や記号が含まれる住所を平仮名に変換する', () => {
    // 「カ」「ケ」は「ケ」に変換される
    expect(toHiragana('オオサカシミナミ3-5-1')).toBe('おおさけしみなみ3-5-1');
  });

  test('空文字の処理を確認する', () => {
    expect(toHiragana('')).toBe('');
  });
});
