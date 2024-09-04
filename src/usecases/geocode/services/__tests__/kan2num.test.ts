import { describe, expect, it } from "@jest/globals";
import { kan2num } from "../kan2num";

describe("kan2num", () => {
  it("should convert Kanji numbers to numbers before place names (ex:丁,番,通, etc.)", () => {
    const result = kan2num("一神戸市一丁目");
    expect(result).toBe("一神戸市1丁目");
  });
  it("should not change number", () => {
    const result = kan2num("神戸市1丁目");
    expect(result).toBe("神戸市1丁目");
  });
  it("should convert Kanji 0-99 to numbers", () => {
    const result = kan2num("神戸市四百四十四丁目マンション三〇二号室");
    expect(result).toBe("神戸市四百44丁目マンション302号室");
  });
  it("should convert only Kanji zero to 0", () => {
    const result = kan2num("神戸市四百四十四丁目マンション零号室");
    expect(result).toBe("神戸市四百44丁目マンション0号室");
  });
  it("convert 大字 like 壱, 弐, 参 to numbers", () => {
    const result = kan2num("神戸市弐丁目");
    expect(result).toBe("神戸市2丁目");
  });
});
