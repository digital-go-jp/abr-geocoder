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
import { describe, expect, it, jest } from '@jest/globals';
import os from 'node:os';
import path from 'node:path';
import { getDataDir } from '../get-data-dir';
import mockedFs from '@mock/fs';
import mockedOs from '@mock/os';

jest.mock('fs');
jest.mock('os');

describe('getDataDir', () => {
  it.concurrent('should create a directory if not existed', async () => {
    const workDir = os.tmpdir();
    const dataDir = await getDataDir(path.join(workDir, 'something'));
    expect(mockedFs.promises.mkdir).toBeCalledWith(`${workDir}/something`, {"recursive": true});
    expect(dataDir).toEqual(`${workDir}/something`);
  });
  it.concurrent('should create a directory at the (os:home) directory', async () => {
    const dataDir = await getDataDir();
    const homeDir = mockedOs.homedir();
    expect(mockedFs.promises.mkdir).toBeCalledWith(`${homeDir}/.abr-geocoder`, {"recursive": true});
    expect(dataDir).toEqual(`${homeDir}/.abr-geocoder`);
  });
});
