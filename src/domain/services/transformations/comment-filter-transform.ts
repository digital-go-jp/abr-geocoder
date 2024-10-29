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

export class CommentFilterTransform extends Transform {
  // 現在のキャレットの位置が、コメントアウトされているかどうか
  private isCuretInComment: boolean = false;
  private _total = 0;
  public get total(): number {
    return this._total;
  }
  private onlyCounting: boolean;

  constructor(params?: {
    onlyCounting: boolean;
  }) {
    super({
      objectMode: true,
    });
    this.onlyCounting = params?.onlyCounting === true;
  }

  _transform(
    line: string,
    _: BufferEncoding,
    callback: TransformCallback,
  ): void {

    let input = line.toString().trim();

    // コメント行と空行は無視する
    if (input.startsWith('#') || input.startsWith('//') || input === '') {
      callback();
      return;
    }

    // 最初と最後にクォーテーションマークが付いている場合は取る
    if (input.length > 1 && (
      (input[0] === "'" && input[input.length - 1] === "'") ||
        (input[0] === '"' && input[input.length - 1] === '"')
    )) {
      input = input.substring(1, input.length - 1);  
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
        if (!this.onlyCounting) {
          buffer.push(input[i]);
        }
        i += 1;
        continue;
      }
      const doubleChars = input.substring(i, i + 2);
      if (doubleChars === '//') {
        break;
      }
      if (doubleChars !== '/*') {
        if (!this.onlyCounting) {
          buffer.push(input[i]);
        }
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
    this._total++;
    if (this.onlyCounting) {
      callback(null);
      return;
    }
    const filteredInput = buffer.join('').trim();

    callback(null, filteredInput);
  }
}
