import { jest, test, describe, expect, beforeAll } from "@jest/globals";
import fs from 'node:fs';
import { parsePackageJson } from "../parse-package-json";

jest.mock('node:fs');

const mockFsReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

mockFsReadFileSync.mockReturnValue(`
{
    "version": "dummy",
    "description": "dummy description"
}
`)

describe("persePackageJson", () => {
    beforeAll(() => {
        mockFsReadFileSync.mockReset();
    });
    test("test1", () => {
        mockFsReadFileSync.mockReturnValue(`
            {
            "version": "dummy",
            "description": "dummy description"
            }
        `);
        const result = parsePackageJson({
            filePath: 'dummy.json',
        });
        expect(result).toEqual({
            version: "dummy",
            description: "dummy description"
        });
    });

    test("test2", () => {
        mockFsReadFileSync.mockReset();
        mockFsReadFileSync.mockImplementation(() =>{
            throw'File not found'
        })

    expect(() => {
        parsePackageJson({
            filePath: 'error.json',
        });
    }).toThrow('File not found');
    });


})
