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
import { Transform, TransformCallback } from "node:stream";

export class StreamLimiter extends Transform {
  private buffer: unknown[] = [];
  constructor(private readonly N: number) {
    super({
      objectMode: true,
    });
  }
  _transform(chunk: unknown, _: BufferEncoding, callback: TransformCallback): void {
    if (this.buffer.length < this.N) {
      this.buffer.push(chunk);
      return callback();
    }
    this.buffer.push(chunk);
    const data = this.buffer;

    this.buffer = [];
    callback(null, data);
  }
  _final(callback: (error?: Error | null | undefined) => void): void {
    this.emit('data', this.buffer);
    callback(null);
  }
}
