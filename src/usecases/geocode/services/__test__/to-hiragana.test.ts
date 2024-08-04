import { test, expect, describe} from "@jest/globals";
import { toHiragana } from "../to-hiragana";

describe("toHiragana", ()=>{
    test("test1", ()=>{
        const result = toHiragana("アイウエオ");
        expect(result).toBe("あいうえお");
    });

    test("test2", ()=>{
        const result = toHiragana("コンニチハ");
        expect(result).toBe("こんにちは");
    })
})