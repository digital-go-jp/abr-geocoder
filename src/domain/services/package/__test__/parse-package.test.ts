import {jest, test, expect, describe , beforeAll} from "@jest/globals"
import {parsePackageJson} from "../parse-package-json"
import fs, { readFileSync } from "node:fs"

jest.mock("node:fs");

const mockedFsReadFileSync = fs.readFileSync as jest.MockedFunction<typeof readFileSync>;



describe("prase package json",()=>{
    beforeAll(()=>{
        mockedFsReadFileSync.mockReset();
    })
    test("test1", ()=>{
        mockedFsReadFileSync.mockReturnValue(`{
    "version":"dummy",
    "description":"dummy description"
    }`);
        const result = parsePackageJson({
            filePath:"dummy.json"
        })
        expect(result).toEqual({
            version:"dummy",
            description:"dummy description"
        })
    });

    test("test2", ()=>{
        mockedFsReadFileSync.mockImplementation(()=>{
            throw "File Not Found";
        })

        expect(()=>{
            parsePackageJson({
                filePath:"error.json"
            })
        }).toThrow("File Not Found");
    })
})