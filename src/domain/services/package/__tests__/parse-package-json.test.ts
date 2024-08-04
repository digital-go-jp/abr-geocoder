import { parsePackageJson } from "../parse-package-json";
import { jest, test, describe, expect, beforeAll } from "@jest/globals";
import fs from "node:fs";

jest.mock("node:fs")

const mockedFsReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>

describe("parsePackageJson", () => {
    beforeAll(() => {
        mockedFsReadFileSync.mockReset()
    })
    test("test1", () => {
        mockedFsReadFileSync.mockReturnValue(`
        {
            "version":"dummy",
            "description":"dummy description"
        }
        `)
        const result = parsePackageJson({ filePath: "dummy.json" })
        console.log(result)
        expect(result).toEqual({
            version: "dummy",
            description: "dummy description"
        })
    })
    test("test2", () => {
        mockedFsReadFileSync.mockReset()
        mockedFsReadFileSync.mockImplementation(() => {
            throw new Error("file not found");
        })
        expect(() => parsePackageJson({ filePath: "error.json" })).toThrow()
    })
})
