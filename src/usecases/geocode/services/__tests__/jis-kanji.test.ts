import { describe, expect, it } from "@jest/globals";
import { jisKanji, jisKanjiForCharNode } from "../jis-kanji";
import { CharNode } from "@usecases/geocode/models/trie/char-node";

describe("jisKanji", () => {
  it("should change 宇都宮 to 宇都宮", () => {
    const result = jisKanji("宇都宮");
    expect(result).toBe("宇都宮");
  });

  it("should change 楠木町 to 楠町", () => {
    const result = jisKanji("京都市中京区間之町通竹屋町下る楠木町601-1");
    expect(result).toBe("京都市中京区間之町通竹屋町下る楠町601-1");
  });
});

describe("jisKanjiForCharNode", () => {
  it("should change 宇都宮 to 宇都宮", () => {
    const request = CharNode.create("宇都宮");
    const result = jisKanjiForCharNode(request);
    expect(result?.toProcessedString()).toBe("宇都宮");
    expect(result?.toOriginalString()).toBe("宇都宮");
  });

  it("should change 楠木町 to 楠町", () => {
    const request = CharNode.create("京都市中京区間之町通竹屋町下る楠木町601-1");
    const result = jisKanjiForCharNode(request);
    expect(result?.toProcessedString()).toBe("京都市中京区間之町通竹屋町下る楠町601-1");
    expect(result?.toOriginalString()).toBe("京都市中京区間之町通竹屋町下る楠木町601-1");
  });
});
