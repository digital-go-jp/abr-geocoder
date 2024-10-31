/*!
 * MIT License
 *
 * Copyright (c) 2024 デジタル庁
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { jest, test, describe, expect, beforeAll } from '@jest/globals';
import fs from 'node:fs';
import { parsePackageJson } from '../parse-package-json';

jest.mock('node:fs');

const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

describe("parsePackageJson", () => {
  beforeAll(() => {
    mockReadFileSync.mockReset();
  });

  test("test1", () => {
    mockReadFileSync.mockReturnValue(`
    {
      "version": "dummy",
      "description": "dummy description"
    }
    `);

    const result = parsePackageJson({
      filePath: 'dummy.json',
    });
    expect(result).toEqual({
      version: 'dummy',
      description: 'dummy description',
    });
  });

  test('test2', () => {
    mockReadFileSync.mockImplementation(() => {
      throw 'File not found';
    });

    expect(() => {
      parsePackageJson({
        filePath: 'error.json',
      });
    }).toThrow('File not found');
  });
});
