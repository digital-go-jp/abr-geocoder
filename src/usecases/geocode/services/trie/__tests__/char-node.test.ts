import { describe, expect, it, jest, test } from '@jest/globals';
import { CharNode } from '../char-node';

// 単体テストなので`toHankakuAlphaNum`はmockする。
jest.mock("../../to-hankaku-alpha-num", () => ({
  toHankakuAlphaNum: jest.fn((str: string) => str),
}));

describe("CharNode", () => {
  describe("constructor", () => {
    test("initialize without initial value setting", () => {
      const node = new CharNode({
        originalChar: undefined,
        char: '',
      });
      expect(node.originalChar).toBe('');
      expect(node.char).toBe('');
      expect(node.ignore).toBe(false);
      expect(node.next).toBeUndefined();
    });
    test("initialize with initial value setting", () => {
      const node = new CharNode({
        originalChar: "ab", 
        char: "bc", 
        ignore: true,
      });
      expect(node.originalChar).toBe("ab");
      expect(node.char).toBe("bc");
      expect(node.ignore).toBe(true);
      expect(node.next).toBeUndefined();
    });
    it("should assign originalChar to char", () => {
      const node = new CharNode({
        char: "ab",
      });
      expect(node.originalChar).toBe("ab");
      expect(node.char).toBe("ab");
      expect(node.ignore).toBe(false);
      expect(node.next).toBeUndefined();
    });
  });

  describe("create", () => {
    it("should create a linked list of CharNodes from a string", () => {
      const node = CharNode.create("aあアﾎﾟ亜1 ");
      expect(node?.char).toBe("a");
      expect(node?.next?.char).toBe("あ");
      expect(node?.next?.next?.char).toBe("ア");
      expect(node?.next?.next?.next?.char).toBe("ﾎ");
      expect(node?.next?.next?.next?.next?.char).toBe("ﾟ");
      expect(node?.next?.next?.next?.next?.next?.char).toBe("亜");
      expect(node?.next?.next?.next?.next?.next?.next?.char).toBe("1");
      expect(node?.next?.next?.next?.next?.next?.next?.next?.char).toBe(" ");
      expect(node?.next?.next?.next?.next?.next?.next?.next?.next?.char).toBeUndefined();
    });
  });

  describe("toProcessedString", () => {
    it("should return the processed string", () => {
      // createは上記の単体テストで保証できている。
      const node = CharNode.create("test aあアﾎﾟ亜1");
      expect(node?.toProcessedString()).toBe("test aあアﾎﾟ亜1");
    });
    it("should ignore nodes with ignore flag set", () => {
      const node = new CharNode({
        char: "test1 ",
      });
      node.next = new CharNode({
        originalChar: "test2 ", 
        char: "test2 ",
        ignore: true,
      });
      node.next.next = new CharNode({
        char: "test3",
      });
      expect(node.toProcessedString()).toBe("test1 test3");
    });
    it("should ignore nodes with undefined char", () => {
      const node = new CharNode({
        char: "test1 ",
      });
      node.next = new CharNode({
        originalChar: undefined, 
        char: '',
        ignore: true,
      });
      node.next.next = new CharNode({
        char: "test2",
      });
      expect(node.toProcessedString()).toBe("test1 test2");
    });
    it("should ignore nodes with empty string", () => {
      const node = new CharNode({
        char: "test1 ",
      });
      node.next = new CharNode({
        originalChar: "",
        char: "",
        ignore: true,
      });
      node.next.next = new CharNode({
        char: "test2",
      });
      expect(node.toProcessedString()).toBe("test1 test2");
    });
  });

  describe("clone", () => {
    it("should create a deep copy", () => {
      const original = CharNode.create("test aあアﾎﾟ亜1");
      const clone = original?.clone();
      expect(clone?.toProcessedString()).toBe("test aあアﾎﾟ亜1");
      // deep copyのため、originalを変更しても変わらない
      original!.next!.char = "hoge hoge";
      expect(clone?.toProcessedString()).toBe("test aあアﾎﾟ亜1");
    });
    it("should copy all setting", () => {
      const firstNode = new CharNode({
        char: "ab",
      });
      const secondNode = new CharNode({
        originalChar: "cd",
        char: "ef",
        ignore: true,
      });
      firstNode.next = secondNode;
      const clone = firstNode.clone();
      expect(clone.char).toBe("ab");
      expect(clone.ignore).toBeFalsy();
      expect(clone.next?.originalChar).toBe("cd");
      expect(clone.next?.char).toBe("ef");
      expect(clone.next?.ignore).toBeTruthy();
    });
  });

  describe("splice", () => {
    it("should delete characters", () => {
      const node = CharNode.create("test to delete string");
      const result = node?.splice(4, 10);
      expect(result?.toProcessedString()).toBe("test string");
    });
    it("should insert a string at a specified index", () => {
      const node = CharNode.create("test string test");
      const result = node?.splice(5, 0, "inserted ");
      expect(result?.toProcessedString()).toBe("test inserted string test");
    });
    it("should insert a string at a specified index with overflow delete", () => {
      const node = CharNode.create("test string test");
      const result = node?.splice(15, 30, "inserted");
      expect(result?.toProcessedString()).toBe("test string tesinserted");
    });
    it("should not change characters", () => {
      const node = CharNode.create("test string");
      const result = node?.splice(4);
      expect(result?.toProcessedString()).toBe("test string");
    });
    it("should ignore ignored node", () => {
      const firstNode = new CharNode({
        originalChar: "test",
        char: '',
        ignore: true,
      });
      const secondNode = new CharNode({
        char: "string",
      });
      firstNode.next = secondNode;
      const result = firstNode.splice(0);
      expect(result?.toProcessedString()).toBe("string");
    });
    it("should ignore ignored node", () => {
      const firstNode = new CharNode({
        originalChar: "test",
        char: '',
        ignore: true,
      });
      const secondNode = new CharNode({
        char: "string",
      });
      firstNode.next = secondNode;
      const result = firstNode.splice(0);
      expect(result?.toProcessedString()).toBe("string");
    });
    it("should ignore overflow delete count", () => {
      const node = CharNode.create("test string");
      const result = node?.splice(4, 99);
      expect(result?.toProcessedString()).toBe("test");
    });
    it("should ignore overflow start index", () => {
      const node = CharNode.create("test string");
      const result = node?.splice(99, 0, "inserted");
      expect(result?.toProcessedString()).toBe("test string");
    });
  });

  describe("replaceAll", () => {
    it("should replace all target string", () => {
      const node = CharNode.create("test string test");
      const result = node?.replaceAll("test", "replaced");
      expect(result?.toProcessedString()).toBe("replaced string replaced");
    });
    it("should not change original node", () => {
      const node = CharNode.create("test string test");
      const result = node?.replaceAll("test", "replaced");
      expect(result?.toProcessedString()).toBe("replaced string replaced");
      expect(node?.toProcessedString()).toBe("test string test");
    });
    it("should apply replace function", () => {
      const node = CharNode.create("test string test");
      const result = node?.replaceAll("test", (match: string) => `'${match}'`);
      expect(result?.toProcessedString()).toBe("'test' string 'test'");
    });
    it("should apply regex in replace", () => {
      const node = CharNode.create("test string test");
      const regex = /[a-z]/g;
      const result = node?.replaceAll(regex, (match: string) => `${match.toUpperCase()}`);
      expect(result?.toProcessedString()).toBe("TEST STRING TEST");
    });
    it("should apply regex with named group in replace", () => {
      const node = CharNode.create("123test_string_78test");
      const regex = /(?<numeric>[0-9]+)(?<alphabet>[a-z]+)/gi;
      const result = node?.replaceAll(regex, (_: string, num: number, alpha: string) => {
        return `${alpha.toUpperCase()}${num}`;
      });
      expect(result?.toProcessedString()).toBe("TEST123_string_TEST78");
    });
  });

  describe("replace", () => {
    it("should replace one target string", () => {
      const node = CharNode.create("test string test");
      const result = node?.replace("test", "replaced");
      expect(result?.toProcessedString()).toBe("replaced string test");
    });
    it("should not change original node", () => {
      const node = CharNode.create("test string test");
      const result = node?.replace("test", "replaced");
      expect(result?.toProcessedString()).toBe("replaced string test");
      expect(node?.toProcessedString()).toBe("test string test");
    });
    it("should apply replace function", () => {
      const node = CharNode.create("test string test");
      const result = node?.replace("test", (match: string) => `'${match}'`);
      expect(result?.toProcessedString()).toBe("'test' string test");
    });
    it("should apply regex in replace", () => {
      const node = CharNode.create("test string test");
      const regex = /[a-z]/g;
      const result = node?.replace(regex, (match: string) => `${match.toUpperCase()}`);
      expect(result?.toProcessedString()).toBe("TEST STRING TEST");
    });
    it("should apply regex with grouping in replace", () => {
      const node = CharNode.create("This image has a resolution of 1440x900 pixels.");
      const regex = /([0-9]+)x([0-9]+)/;
      const result = node?.replace(regex, `width: $1, height: $2`);
      expect(result?.toProcessedString()).toBe("This image has a resolution of width: 1440, height: 900 pixels.");
    });
  });

  describe("toOriginalString", () => {
    it("should get original string with replaceAll method", () => {
      const node = CharNode.create("test string test");
      const replaced = node?.replaceAll("test", "replaced");
      const original = replaced?.toOriginalString();
      const processing = replaced?.toProcessedString();
      expect(original).toBe("test string test");
      expect(processing).toBe("replaced string replaced");
    });
    it("should get original string even if replaceValue is shorter than search word", () => {
      const node = CharNode.create("test string test");
      const replaced = node?.replaceAll("test", "xy");
      const original = replaced?.toOriginalString();
      const processing = replaced?.toProcessedString();
      expect(original).toBe("test string test");
      expect(processing).toBe("xy string xy");
    });
    it("should get original string with replace method", () => {
      const node = CharNode.create("test string test");
      const replaced = node?.replace("test", "replaced");
      const original = replaced?.toOriginalString();
      const processing = replaced?.toProcessedString();
      expect(original).toBe("test string test");
      expect(processing).toBe("replaced string test");
    });
    it("should get original string even if replaceValue is an empty string", () => {
      const node = CharNode.create("test string test");
      const replaced = node?.replaceAll("test", '');
      const original = replaced?.toOriginalString();
      const processing = replaced?.toProcessedString();
      expect(original).toBe("test string test");
      expect(processing).toBe(" string ");
    });
    it("should get original string even if replaceValue is shorter than search word", () => {
      const node = CharNode.create("test string test");
      const replaced = node?.replace("test", "xy");
      const original = replaced?.toOriginalString();
      const processing = replaced?.toProcessedString();
      expect(original).toBe("test string test");
      expect(processing).toBe("xy string test");
    });
    it("should get original string even if replaceValue is an empty string", () => {
      const node = CharNode.create("test string test");
      const replaced = node?.replace("test", '');
      const original = replaced?.toOriginalString();
      const processing = replaced?.toProcessedString();
      expect(original).toBe("test string test");
      expect(processing).toBe(" string test");
    });
  });

  describe("toJson", () => {
    it("should get json", () => {
      const firstNode = new CharNode({
        originalChar: "test1",
        char: "test2",
        ignore: true,
      });
      const secondNode = new CharNode({
        char: "string",
      });
      firstNode.next = secondNode;
      const result = firstNode.toJSON();
      const expected: ReturnType<typeof firstNode.toJSON> = [
        {
          org: "test1",
          char: "test2",
          ignore: true,
        },
        {
          org: "string",
          char: "string",
          ignore: false,
        },
      ];
      expect(result).toStrictEqual(expected);
    });
  });

  describe("toString", () => {
    it("should get string", () => {
      const firstNode = new CharNode({
        originalChar: "test1",
        char: "test2",
        ignore: true,
      });
      const secondNode = new CharNode({
        char: "string",
      });
      firstNode.next = secondNode;
      const result = firstNode.toString();
      const expected = '[{"org":"test1","char":"test2","ignore":true},{"org":"string","char":"string","ignore":false}]';
      expect(result).toBe(expected);
    });
  });

  describe("fromString", () => {
    it("should create CharNode from JSON string", () => {
      const jsonString = JSON.stringify("test aあアﾎﾟ亜1");
      const node = CharNode.fromString(jsonString);
      expect(node?.toProcessedString()).toBe("test aあアﾎﾟ亜1");
    });
    it("should create CharNode from JSON array string", () => {
      const jsonString = JSON.stringify([
        { org: "t", char: "e", ignore: false },
        { org: "e", char: "x", ignore: false },
        { org: "s", char: "a", ignore: false },
        { org: "t", char: "m", ignore: false },
      ]);
      const node = CharNode.fromString(jsonString);
      expect(node?.toProcessedString()).toBe("exam");
    });
    it("should throw for invalid string", () => {
      expect(() => CharNode.fromString("invalid")).toThrow("unexpected format");
    });
  });
});
