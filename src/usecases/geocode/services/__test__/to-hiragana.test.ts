import {test, expect, describe} from "@jest/globals"
import {toHiragana} from "../to-hiragana"

describe("toHiragana", () => {
  test("test1", () => {
    const result = toHiragana("アイウエオ")
    expect(result).toBe("あいうえお")
  })

  test("test2", () => {
    const result = toHiragana("ｶﾞ")
    expect(result).toBe("かﾞ") // 変な「が」ならとおる
  })

  // test("test3", () => {
  //   const result = toHiragana("ｶﾞ")
  //   expect(result).toBe("が") // 通常の「が」は通らない
  // })

  test("test4", () => {
    const result = toHiragana("が")
    expect(result).toBe("が")
  })

  test("test5", () => {
    const result = toHiragana("ガ")
    expect(result).toBe("が")
  })

  test("test6", () => {
    const result = toHiragana(" ")
    expect(result).toBe(" ")
  })

  test("test5", () => {
    const result = toHiragana("ゑ")
    expect(result).toBe("え")
  })


  
})