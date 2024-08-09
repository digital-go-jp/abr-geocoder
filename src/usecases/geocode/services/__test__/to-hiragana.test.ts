import {test, expect, describe} from "@jest/globals"
import {toHiragana} from "../to-hiragana"

describe("toHiragana", () => {
  test("test1", () => {
    const result = toHiragana("アイウエオ")
    expect(result).toBe("あいうえお")
  })

  test("test2", () => {
    const result = toHiragana("カタカナとひらがな")
    expect(result).toBe("かたかなとひらがな")
  })

  test("test3", () => {
    const result = toHiragana("さしすせそ")
    expect(result).toBe("さしすせそ")
  })

  test("test4", () => {
    const result = toHiragana("")
    expect(result).toBe("")
  })

  test("test5", () => {
    const result = toHiragana("漢字とカタカナ")
    expect(result).toBe("漢字とかたかな")
  })

  test("test6", () => {
    const result = toHiragana("カタカナと！ひらがな？")
    expect(result).toBe("かたかなと！ひらがな？")
  })

  test("test7", () => {
    const result = toHiragana("カタカナ123とABCひらがな")
    expect(result).toBe("かたかな123とABCひらがな")
  })
})
