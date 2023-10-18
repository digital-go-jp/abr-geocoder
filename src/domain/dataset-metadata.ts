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
export interface IDatasetMetadata {
  lastModified?: string;
  contentLength: number;
  etag?: string;
  fileUrl: string;
}
export class DatasetMetadata implements IDatasetMetadata {
  public readonly lastModified?: string;
  public readonly contentLength: number;
  public readonly etag?: string;
  public readonly fileUrl: string;

  constructor(params: {
    lastModified?: string;
    contentLength: number;
    etag?: string;
    fileUrl: string;
  }) {
    this.lastModified = params.lastModified;
    this.contentLength = params.contentLength;
    this.etag = params.etag;
    this.fileUrl = params.fileUrl;
    Object.freeze(this);
  }

  toJSON() {
    return {
      lastModified: this.lastModified,
      contentLength: this.contentLength,
      etag: this.etag,
      fileUrl: this.fileUrl,
    };
  }

  toString() {
    return JSON.stringify(this.toJSON());
  }

  equal(other?: DatasetMetadata): boolean {
    if (!other) {
      return false;
    }

    return (
      this.contentLength === other.contentLength &&
      this.etag === other.etag &&
      this.fileUrl === other.fileUrl &&
      this.lastModified === other.lastModified
    );
  }

  static from = (value: string): DatasetMetadata => {
    const jsonValue = JSON.parse(value);
    if (
      !('lastModified' in jsonValue) ||
      !('contentLength' in jsonValue) ||
      !('etag' in jsonValue) ||
      !('fileUrl' in jsonValue)
    ) {
      throw new Error('Can not parse value as DatasetMetadata');
    }
    return new DatasetMetadata(jsonValue);
  };
}
