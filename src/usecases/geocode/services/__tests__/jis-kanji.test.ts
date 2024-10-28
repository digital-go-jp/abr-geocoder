import { describe, expect, test } from "@jest/globals";
import { jisKanji } from "../jis-kanji";
import { CharNode } from "@usecases/geocode/models/trie/char-node";

describe("jisKanji", () => {
  test("should change 宇都宮 to 宇都宮", () => {
    const request = CharNode.create("宇都宮");
    const result = jisKanji(request);
    expect(result?.toProcessedString()).toBe("宇都宮");
    expect(result?.toOriginalString()).toBe("宇都宮");
  });

  test("should change 楠木町 to 楠町", () => {
    const request = CharNode.create("京都市中京区間之町通竹屋町下る楠木町601-1");
    const result = jisKanji(request);
    expect(result?.toProcessedString()).toBe("京都市中京区間之町通竹屋町下る楠町601-1");
    expect(result?.toOriginalString()).toBe("京都市中京区間之町通竹屋町下る楠木町601-1");
  });
});

describe("jisKanji", () => {
  test("should change 宇都宮 to 宇都宮", () => {
    const result = jisKanji("宇都宮");
    expect(result).toBe("宇都宮");
  });

  test("should change 楠木町 to 楠町", () => {
    const result = jisKanji("京都市中京区間之町通竹屋町下る楠木町601-1");
    expect(result).toBe("京都市中京区間之町通竹屋町下る楠町601-1");
  });

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

  test('東京都千代田区糀町一丁目', () => {
    const input = '東京都千代田区糀町一丁目';
    const expectedOutput = '東京都千代田区麹町一丁目';
    expect(jisKanji(input)).toBe(expectedOutput);
  });

  test('東京都千代田区麹町一丁目', () => {
    const input = '東京都千代田区麹町一丁目';
    const expectedOutput = '東京都千代田区麹町一丁目';
    expect(jisKanji(input)).toBe(expectedOutput);
  });
});
