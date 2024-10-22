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
import fs from 'node:fs';
import buffCrc32 from 'buffer-crc32';
import { serialize } from 'node:v8';

export const fromFile = (pathToFile: string): string | null => {
  if (!fs.existsSync(pathToFile)) {
    return null;
  }
  const fileBuff = fs.readFileSync(pathToFile);
  return fromBuffer(fileBuff);
};

export const fromBuffer = (data: Buffer): string => {
  return buffCrc32.unsigned(data).toString(16);
};

export const fromString = (data: string): string => {
  return fromBuffer(Buffer.from(data));
};

export const fromRecord = (data: {}): string => {
  return fromString(JSON.stringify(data))
};

export default {
  fromFile,
  fromBuffer,
  fromString,
  fromRecord,
};
