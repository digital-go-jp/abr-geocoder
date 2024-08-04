import {jest, test, expect, describe} from "@jest/globals"
import { parsePackageJson } from "../parse-package-json"
import fs from "node:fs"

jest.mock("node:fs")
const mockedFsReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>

// mockedFsReadFileSync.mockImplementation(path => {
//   if (path === "dummy file path") {
//     return JSON.stringify({
//       version: "dummy version",
//       description: "dummy description",
//     })
//   }
// })

mockedFsReadFileSync.mockReturnValue(JSON.stringify({
  name: "dummy name",
  version: "dummy version",
  description: "dummy description",
}))

describe("parsePackageJson", () => {

  test("test1", () => {
    const result = parsePackageJson({
      filePath: "dummy file path",
    })
    expect(result).toEqual({
      version: "dummy version",
      description: "dummy description",
    })
  })

  test("test2", ()=>{
    mockedFsReadFileSync.mockReset()
    mockedFsReadFileSync.mockImplementation(() => {
      throw new Error("File not found")
    })
    expect(() => parsePackageJson({
      filePath: "dummy file path",
    })).toThrow("File not found")
  })
})