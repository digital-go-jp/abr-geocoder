import { DASH, SPACE } from '@config/constant-values';
import { RegExpEx } from '@domain/services/reg-exp-ex';
import { describe, expect, it, test } from '@jest/globals';
import { CharNode } from '../char-node';

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

  describe("headOf", () => {
    it("should return the head node of the search word.", () => {
      
      const node = CharNode.create(`下京区下珠数屋町東洞院東入ル飴屋町`);
      const result = node?.headOf('東入');
      expect(result?.toProcessedString()).toBe(`東入ル飴屋町`);
      expect(result?.toOriginalString()).toBe(`東入ル飴屋町`);
    });

    it("should return undefined if not found.", () => {
      
      const node = CharNode.create(`下京区下珠数屋町東洞院東入ル飴屋町`);
      const result = node?.headOf('西入');
      expect(result).toBeUndefined();
    });

    it("should return undefined if the search word length is too long.", () => {
      
      const node = CharNode.create(`あいうえお`);
      const result = node?.headOf('あいうえおかきく');
      expect(result).toBeUndefined();
    });
    it("should return the head node if the search word is an empty string.", () => {
      
      const node = CharNode.create(`あいうえお`);
      const result = node?.headOf('');
      expect(result?.toProcessedString()).toBe(`あいうえお`);
      expect(result?.toOriginalString()).toBe(`あいうえお`);
    });
  });

  describe("substring", () => {
    it("should return the substring with specified range.", () => {
      
      const node = CharNode.create(`下京区下珠数屋町東洞院東入ル飴屋町`);
      const result = node!.substring(3, 6);
      expect(result?.toProcessedString()).toBe(`下珠数`);
    });
    it("should return the substring until the end if indexEnd is omitted.", () => {
      
      const node = CharNode.create(`下京区下珠数屋町東洞院東入ル飴屋町`);
      const result = node!.substring(3);
      expect(result?.toProcessedString()).toBe(`下珠数屋町東洞院東入ル飴屋町`);
    });
    it("should return the substrings as expected.", () => {
      
      const node = CharNode.create(`下京区下珠数屋町東洞院東入ル飴屋町`);
      const koaza = node!.substring(0, 11);
      expect(koaza?.toProcessedString()).toBe(`下京区下珠数屋町東洞院`);
      const bearing = node!.substring(11, 14);
      expect(bearing?.toProcessedString()).toBe(`東入ル`);
      const oazaCho = node!.substring(14);
      expect(oazaCho?.toProcessedString()).toBe(`飴屋町`);
    });
  });

  describe("match", () => {
    it("should return the head node of the search word.", () => {
      
      const node = CharNode.create(`下京区下珠数屋町東洞院東入ル飴屋町`);
      const result = node!.match(/[東西]入/g);
      expect(result?.node.toProcessedString()).toBe(`東入ル飴屋町`);
      expect(result?.index).toBe(11);
      expect(result?.lastIndex).toBe(13);
    });

    it("should return the first matched positions only.", () => {
      
      const node = CharNode.create(`table football, foosball`);
      const result = node!.match(/fo*/g);
      expect(result?.node.toProcessedString()).toBe(`football, foosball`);
      expect(result?.index).toBe(6);
      expect(result?.lastIndex).toBe(9);
    });
    it("should return the head node of the search word for non-global regexp.", () => {
      
      const node = CharNode.create(`寺町通石薬師下る西側染殿町658`);
      const result = node!.match(RegExpEx.create('(?:上|下|東入|西入)る?'));
      expect(result?.node.toProcessedString()).toBe(`下る西側染殿町658`);
      expect(result?.index).toBe(6);
      expect(result?.lastIndex).toBe(8);
    });

  });

  describe("matchAll", () => {
    it("should return the head node of the search word.", () => {
      
      const node = CharNode.create(`下京区下珠数屋町東洞院東入ル飴屋町`);
      const results = node!.matchAll(/[東西]入/g);
      expect(results.length).toBe(1);
      expect(results[0].node.toProcessedString()).toBe(`東入ル飴屋町`);
      expect(results[0].index).toBe(11);
      expect(results[0].lastIndex).toBe(13);
    });

    it("should return the all matched positions.", () => {
      
      const node = CharNode.create(`table football, foosball`);
      const results = node!.matchAll(/fo*/g);
      expect(results.length).toBe(2);
      expect(results[0].node.toProcessedString()).toBe(`football, foosball`);
      expect(results[0].index).toBe(6);
      expect(results[0].lastIndex).toBe(9);
      expect(results[1].node.toProcessedString()).toBe(`foosball`);
      expect(results[1].index).toBe(16);
      expect(results[1].lastIndex).toBe(19);
    });
  });

  describe("trimWith", () => {
    it("should return remove the SPACEs at prefix and suffix.", () => {
      
      const node = CharNode.create(`${SPACE}あいう${DASH}えお${SPACE}${SPACE}`);
      const result = node?.trimWith();
      expect(result?.toProcessedString()).toBe(`あいう${DASH}えお`);
      expect(result?.toOriginalString()).toBe(`あいう${DASH}えお`);
    });
    it("should return remove the DASHs at prefix and suffix.", () => {
      
      const node = CharNode.create(`${DASH}${DASH}あいう${DASH}えお${DASH}`);
      const result = node?.trimWith(DASH);
      expect(result?.toProcessedString()).toBe(`あいう${DASH}えお`);
      expect(result?.toOriginalString()).toBe(`あいう${DASH}えお`);
    });
    it("should keep the characters which are marked as ignored.", () => {
      
      let node = CharNode.create(`(KEEP)${DASH}あいう${DASH}えお${DASH}(KEEP)`);
      node = node?.replaceAll('(KEEP)', '');  // Set ignore = true on "(KEEP)" words.
      const result = node?.trimWith(DASH);
      expect(result?.toProcessedString()).toBe(`あいう${DASH}えお`);
      expect(result?.toOriginalString()).toBe(`(KEEP)あいう${DASH}えお(KEEP)`);
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

  describe("joinWith", () => {
    it("should create a connected string", () => {
      const str1 = CharNode.create("str1");
      const str2 = CharNode.create("str2");
      const connector = CharNode.create('<connect>')!;
      const result = CharNode.joinWith(connector, str1, str2);

      expect(result?.toProcessedString()).toBe("str1<connect>str2");
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

    it("should remove only the last dash", () => {
      const node = CharNode.create(`あいう${DASH}`);
      node!.next!.ignore = true;
      const result = node!.replaceAll(new RegExp(`[${SPACE}${DASH}]$`, 'g'), '');
      expect(result?.toProcessedString()).toBe("あう");
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
