import { DASH } from "@config/constant-values";
import { describe, expect, test } from "@jest/globals";
import { OazaChoTrieFinder } from "../oaza-cho-trie-finder";

describe('OazaChoTrieFinder', () => {

  test('should convert "軒", "条" and "丁目" to DASH symbols', async () => {
    const result = OazaChoTrieFinder.normalizeStr('二十四軒三条一丁目');
    expect(result).toBe(`24${DASH}3${DASH}1`);
  });
  test('should convert "軒", "条", "丁目" and "の" to DASH symbols', async () => {
    const result = OazaChoTrieFinder.normalizeStr('二十四軒三条一丁目三の三');
    expect(result).toBe(`24${DASH}3${DASH}1${DASH}3${DASH}3`);
  });
});
