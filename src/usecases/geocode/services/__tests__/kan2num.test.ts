import { describe, expect, test } from "@jest/globals";
import { kan2num } from "../kan2num";

describe("kan2num", () => {

  test('should convert "一" to "1"', () => {
    const result = kan2num('ソルティア岡本一');
    expect(result).toBe('ソルティア岡本1');
  });
  
  test('should convert "四十四" to "44"', () => {
    const result = kan2num('ソルティア岡本四十四');
    expect(result).toBe('ソルティア岡本44');
  });

  test('should convert "二十五" to "25", and "三十一" to "31"', () => {
    const result = kan2num('二十五丁目三十一番地');
    expect(result).toBe('25丁目31番地');
  });

  test('should convert "二十五" to "25", and "三十一" to "31"', () => {
    const result = kan2num('二十五丁目三十一番地');
    expect(result).toBe('25丁目31番地');
  });
  
  test('should convert "二十四" to "24", "三" to "3", and "一" to "1"', () => {
    const result = kan2num('二十四軒三条一丁目');
    expect(result).toBe('24軒3条1丁目');
  });

  test("should convert Kanji numbers to numbers before place names (ex:丁,番,通, etc.)", () => {
    const result = kan2num("一神戸市一丁目");
    expect(result).toBe("一神戸市1丁目");
  });
  test("should not change number", () => {
    const result = kan2num("神戸市1丁目");
    expect(result).toBe("神戸市1丁目");
  });
  test("should convert Kanji 0-99 to numbers", () => {
    const result = kan2num("神戸市四百四十四丁目マンション三〇二号室");
    expect(result).toBe("神戸市四百44丁目マンション302号室");
  });
  test("should convert only Kanji zero to 0", () => {
    const result = kan2num("神戸市四百四十四丁目マンション零号室");
    expect(result).toBe("神戸市四百44丁目マンション0号室");
  });
  test("should convert 大字 like 壱, 弐, 参 to numbers", () => {
    const result = kan2num("神戸市弐丁目");
    expect(result).toBe("神戸市2丁目");
  });

});
  
