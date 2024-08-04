import { test, expect, describe} from "@jest/globals";

import { kan2num } from "../kan2num"


describe("kan2num test", ()=>{
    test("test1", ()=>{
        const result = kan2num("壱");
        expect(result).toBe("1");
    });
    test("test2", ()=>{
        const result = kan2num("ソルティア岡本一丁目");
        expect(result).toBe("ソルティア岡本1丁目")
    });
    test("test3", ()=>{
        const result = kan2num("ディアコート４号０１０３");
        expect(result).toBe("ディアコート4号0103")
    })
})