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
import { Transform } from 'node:stream';
import { TransformCallback } from 'stream';

export class TextReaderTransform extends Transform {
  // 現在のキャレットの位置が、コメントアウトされているかどうか
  private isCuretInComment: boolean = false;
  private _total = 0;
  public get total(): number {
    return this._total;
  }

  constructor() {
    super({
      objectMode: true,
    });
  }

  _transform(
    line: string,
    _: BufferEncoding,
    callback: TransformCallback,
  ): void {

    const input = line.toString().trim();

    // コメント行と空行は無視する
    if (input.startsWith('#') || input.startsWith('//') || input === '') {
      callback();
      return;
    }

    // /* ... */ の間をコメントとして無視する。複数行にも対応
    // "//" より後ろは、コメントとして無視する
    const buffer: string[] = [];
    let i = 0;
    const N = input.length;
    while (i < N) {
      if (this.isCuretInComment) {
        if (i + 1 >= N || input.substring(i, i + 2) !== '*/') {
          i += 1;
          continue;
        }

        this.isCuretInComment = false;
        i += 2;
        continue;
      }

      if (i + 1 >= N) {
        buffer.push(input[i]);
        i += 1;
        continue;
      }
      const doubleChars = input.substring(i, i + 2);
      if (doubleChars === '//') {
        break;
      }
      if (doubleChars !== '/*') {
        buffer.push(input[i]);
        i += 1;
        continue;
      }

      this.isCuretInComment = true;
      i += 2;
    }
    if (buffer.length === 0) {
      callback();
      return;
    }
    const filteredInput = buffer.join('');
    this._total++;
    if (this._total % 10 === 0) {
      this.emit('total', this._total);
    }

    callback(null, filteredInput);
  }

  _final(callback: TransformCallback): void {
    this.emit('total', this._total);
    callback();
  }

}