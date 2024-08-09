import {test, expect, describe} from "@jest/globals"
import {kan2num} from "../kan2num"

describe("kan2num", () => {
  test("test1", () => {
    const result = kan2num("一二三")
    expect(result).toBe("123")
  })

  test("test2", () => {
    const result = kan2num("壱弐参カタカナ")
    expect(result).toBe("123カタカナ")
  })

  test("test3", () => {
    const result = kan2num("四五六ひらがな")
    expect(result).toBe("456ひらがな")
  })

  test("test4", () => {
    const result = kan2num("！")
    expect(result).toBe("！")
  })

  test("test5", () => {
    const result = kan2num("123")
    expect(result).toBe("123")
  })

  test("test6", () => {
    const result = kan2num("十二丁目")
    expect(result).toBe("12丁目")
  })

  test("test7", () => {
    const result = kan2num("東京都港区三田二丁目２番１８号")
    expect(result).toBe("東京都港区三田2丁目2番18号")
  })
})
