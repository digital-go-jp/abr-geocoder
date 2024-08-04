import { describe, expect, test } from "@jest/globals";
import { kan2num } from "../kan2num";

describe("kan2num", () => {
    test("test1", () => {
        const result = kan2num("神戸市一丁目")
        expect(result).toBe("神戸市1丁目")
    })
    test("test2", () => {
        const result = kan2num("神戸市四百四十四丁目")
        expect(result).toBe("神戸市四百44丁目")
    })
    test("test3", () => {
        const result = kan2num("二十三の三十五番地")
        expect(result).toBe("23の35番地")
    })
})
