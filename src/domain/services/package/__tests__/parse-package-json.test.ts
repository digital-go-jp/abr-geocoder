import { jest, test, expect, describe, beforeAll } from '@jest/globals';
import fs from 'node:fs';
import {parsePackageJson} from "../parse-package-json";

jest.mock('node:fs');

const mockFsReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

describe("parsePackageJson", () => {
    beforeAll(() => {
        mockFsReadFileSync.mockReset();
    })
    test("test1", () => {
        mockFsReadFileSync.mockReturnValue(`
        {
            "version": "1.0.0",
            "description": "dummy"
        }
        `)
        const result = parsePackageJson({
            filePath: 'dummy.json',
        });

        expect(result).toEqual({
            "version": "1.0.0",
            "description": "dummy"
        })
    });
    test("test2", () => {
        mockFsReadFileSync.mockImplementation(() => {
            throw 'File not found';
        })
        expect(() => {
          parsePackageJson(({
              filePath: 'error.json',
          }))
        }).toThrow('File not found');
    });
})