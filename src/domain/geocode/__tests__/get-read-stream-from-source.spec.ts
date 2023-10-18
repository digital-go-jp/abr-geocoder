/*!
 * MIT License
 *
 * Copyright (c) 2023 デジタル庁
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
import { AbrgError, AbrgErrorLevel } from '@abrg-error/abrg-error';
import { AbrgMessage } from '@abrg-message/abrg-message';
import { describe, expect, it, jest } from '@jest/globals';
import mockedFs from '@mock/fs';
import { SINGLE_DASH_ALTERNATIVE } from '@settings/constant-values';
import { getReadStreamFromSource } from '../get-read-stream-from-source';

const fs = jest.requireActual('fs');

jest.dontMock('../get-read-stream-from-source');

describe('getReadStreamFromSource', () => {
  it('should return process.stdin if the command is involved by "abrg -"', () => {
    const orgStdIn = Object.create(process.stdin);
    Reflect.defineProperty(orgStdIn, 'isTTY', {
      value: false,
    });
    Reflect.defineProperty(orgStdIn, 'isDummy', {
      value: true,
    });
    
    const mockStdIn = jest.spyOn(process, 'stdin', 'get').mockReturnValue(orgStdIn);
    const result = getReadStreamFromSource(SINGLE_DASH_ALTERNATIVE);
    expect((result as any).isDummy).toEqual(true);

    mockStdIn.mockRestore();
    Reflect.deleteProperty(orgStdIn, 'isTTY');
  });
  it('should throw an error if the command is involved by "abrg -" and process.stdin.isTTY', () => {
    const orgStdIn = Object.create(process.stdin);
    Reflect.defineProperty(orgStdIn, 'isTTY', {
      value: true,
    });
    Reflect.defineProperty(orgStdIn, 'isDummy', {
      value: true,
    });
    
    const mockStdIn = jest.spyOn(process, 'stdin', 'get').mockReturnValue(orgStdIn);
    expect(() => {
      getReadStreamFromSource(SINGLE_DASH_ALTERNATIVE);
    }).toThrow(new AbrgError({
      messageId: AbrgMessage.INPUT_SOURCE_FROM_STDIN_ERROR,
      level: AbrgErrorLevel.ERROR,
    }));

    mockStdIn.mockRestore();
    Reflect.deleteProperty(orgStdIn, 'isTTY');
  });

  it('should occur an error if source is invalid file path.', () => {
    expect(() => {
      getReadStreamFromSource('somewhere');
    }).toThrow(new AbrgError({
      messageId: AbrgMessage.CANNOT_FIND_INPUT_FILE,
      level: AbrgErrorLevel.ERROR,
    }));
  });

  it('should return fs.ReadStream if source is a valid file', () => {
    mockedFs.existsSync.mockReturnValue(true);
    const result = getReadStreamFromSource(__filename);
    expect(result).toBeInstanceOf((fs as typeof import('fs')).ReadStream);
  });
})