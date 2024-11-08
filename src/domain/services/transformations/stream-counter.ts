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

export class StreamCounter extends Transform {
  private count: number = 0;
  private prevCount: number = 0;
  private timer: NodeJS.Timeout;

  constructor({
    fps = 10,
    callback,
  }: {
    callback: (current: number) => void,
    fps: number;
  }) {
    super({
      objectMode: true,
    });

    if (fps <= 1) {
      fps = 10;
    }

    this.timer = setInterval(() => {
      if (this.prevCount === this.count) {
        return;
      }
      this.prevCount = this.count;
      callback(this.count);
    }, 1000 / Math.floor(fps));
  }
  _transform(chunk: unknown, _: BufferEncoding, callback: TransformCallback): void {
    this.count++;
    callback(null, chunk);
  }

  _final(callback: (error?: Error | null) => void): void {
    clearInterval(this.timer);
    callback();
  }
}
