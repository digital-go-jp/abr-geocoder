import { describe, expect, it } from "@jest/globals";
import { toHiragana } from "../to-hiragana";

describe("toHiragana", () => {
  it("should not change general Hiragana", () => {
    const result = toHiragana("あいうえお");
    expect(result).toBe("あいうえお");
  });
  it("should not change general Kanji", () => {
    const result = toHiragana("あいう漢字えお");
    expect(result).toBe("あいう漢字えお");
  });
  it("should not change number", () => {
    const result = toHiragana("あいう123えお");
    expect(result).toBe("あいう123えお");
  });
  it("should not change alphabet", () => {
    const result = toHiragana("あいうabcdeえお");
    expect(result).toBe("あいうabcdeえお");
  });
  it("should convert general Katakana to Hiragana", () => {
    const result = toHiragana("アイウエオ");
    expect(result).toBe("あいうえお");
  });
  it("should convert Katakana with voiced sound mark to Hiragana", () => {
    const result = toHiragana("ガギグゲゴ");
    expect(result).toBe("がぎぐげご");
  });
  it("should convert Katakana with semi-voiced sound mark to Hiragana", () => {
    const result = toHiragana("パピプペポ");
    expect(result).toBe("ぱぴぷぺぽ");
  });
  it("should convert Katakana to half-width Hiragana", () => {
    const result = toHiragana("あいうﾊﾝｶｸえお");
    expect(result).toBe("あいうはんかくえお");
  });
  /**
     * HiraganaMapでは'ｶﾞ'は'が'に対応しているが、
     * toHiraganaの`const char of target`では'ｶ',''ﾞ'に分割されている。
     * これは想定通り？
     **/
  it("should convert half-width Katakana with voiced sound mark to Hiragana and half-width voiced sound mark", () => {
    const result = toHiragana("ｶﾞｷﾞｸﾞｹﾞｺﾞ");
    expect(result).toBe("かﾞきﾞくﾞけﾞこﾞ");
  });
  it("should convert 'ケ' to 'が' (for 竜ケ崎, 八ケ岳, etc.)", () => {
    const result = toHiragana("カキクケコ");
    expect(result).toBe("かきくがこ");
  });
  it("should convert 'ゑ' to 'え', 'ヱ' to 'え', and '之' to 'の'", () => {
    const result = toHiragana("ゑヱ之");
    expect(result).toBe("ええの");
  });
  /**
     * HiraganaMapに登録されているが、理由は不明
     */
  it("should convert 'ょ' to 'よ', 'ョ' to 'よ', and 'ｮ' to 'よ'", () => {
    const result = toHiragana("きょうキョウｷｮｳ");
    expect(result).toBe("きようきようきよう");
  });
});
