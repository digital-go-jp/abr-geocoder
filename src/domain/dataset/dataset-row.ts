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
export interface IDatasetRow {
  key: string;
  type: string;
  contentLength: number;
  crc32: number;
  lastModified: number;
}

export class DatasetRow implements IDatasetRow {
  public readonly key: string;
  public readonly type: string;
  public readonly contentLength: number;
  public readonly crc32: number;
  public readonly lastModified: number;

  constructor({
    key,
    type,
    contentLength,
    crc32,
    lastModified,
  }: {
    key: string;
    type: string;
    contentLength: number;
    crc32: number;
    lastModified: number;
  }) {
    this.key = key;
    this.type = type;
    this.contentLength = contentLength;
    this.crc32 = crc32;
    this.lastModified = lastModified;
    Object.freeze(this);
  }

  equalExceptType(other?: {
    key: string;
    contentLength: number;
    crc32: number;
    lastModified: number;
  }) {
    if (!other) {
      return false;
    }
    return (
      this.key === other.key &&
      this.crc32 === other.crc32 &&
      this.contentLength === other.contentLength &&
      this.lastModified === other.lastModified
    );
  }
}
