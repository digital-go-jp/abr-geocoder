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
import StreamZip from 'node-stream-zip';
import { IStreamReady } from './istream-ready';

export class StreamReady implements IStreamReady {
  private streamFactory: () => Promise<NodeJS.ReadableStream>;
  public readonly name: string;
  public readonly crc32: number;
  public readonly contentLength: number;
  public readonly lastModified: number;

  constructor({
    zipEntry,
    streamFactory,
  }: {
    streamFactory: () => Promise<NodeJS.ReadableStream>;
    zipEntry: StreamZip.ZipEntry;
  }) {
    this.streamFactory = streamFactory;
    this.name = zipEntry.name;
    this.crc32 = zipEntry.crc;
    this.lastModified = zipEntry.time;
    this.contentLength = zipEntry.size;
    Object.freeze(this);
  }

  async getStream(): Promise<NodeJS.ReadableStream> {
    return await this.streamFactory();
  }
}
