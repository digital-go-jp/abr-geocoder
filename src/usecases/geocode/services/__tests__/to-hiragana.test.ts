import { describe, expect, test } from "@jest/globals";
import { toHiragana } from "../to-hiragana";

describe("toHiragana", () => {
    test("test1", () => {
        const result = toHiragana("あいうえお")
        expect(result).toBe("あいうえお")
    })
    test("test2", () => {
        const result = toHiragana("あいう漢字えお")
        expect(result).toBe("あいう漢字えお")
    })
    test("test3", () => {
        const result = toHiragana("あいうﾊﾝｶｸえお")
        expect(result).toBe("あいうはんかくえお")
    })
    test("test4", () => {
        const result = toHiragana("あいう123えお")
        expect(result).toBe("あいう123えお")
    })
    test("test5", () => {
        const result = toHiragana("カキクケコ")
        expect(result).toBe("かきくがこ")
    })
})
