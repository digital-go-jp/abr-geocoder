import { parsePackageJson } from '../parse-package-json';
import {expect, test, describe, jest, beforeAll} from '@jest/globals';
import fs from "node:fs";

jest.mock('node:fs');

const mockedFileReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;


describe('parsePackageJson', () => {
    beforeAll(() => {
        mockedFileReadFileSync.mockReset();
    });

    test('test1', () => {
        mockedFileReadFileSync.mockReturnValue(`
        {
            "version": "dummy",
            "description": "dummy description"
        }
        `);

        const result = parsePackageJson({
            filePath: 'dummy.json'
        });
        expect(result).toEqual({
            version: 'dummy',
            description: 'dummy description'
        });
    });

    test('test2', () => {
        mockedFileReadFileSync.mockImplementation(() => {
            throw 'file not found';
        });

        expect(() => {
            parsePackageJson({
                filePath: 'error.json'
            });
        }).toThrow('file not found');
    });
});
