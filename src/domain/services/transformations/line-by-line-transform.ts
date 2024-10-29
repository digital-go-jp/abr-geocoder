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
import { Duplex } from "stream";

export class LineByLineTransform extends Duplex {
  private prevBuffer: Buffer | null = null;
  private bomCheck: boolean;

  constructor(private options: {
    encoding: BufferEncoding;
    skipBomCheck: boolean;
  } = {
    encoding: 'utf-8',
    skipBomCheck: false,
  }) {
    super({
      allowHalfOpen: true,
      read() {},
    });

    this.bomCheck = !this.options.skipBomCheck;
  }
  _write(chunk: string | Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    if (typeof chunk === 'string') {
      chunk = Buffer.from(chunk);
    }

    // ファイルの先頭にBOMが含まれていないかチェックする
    if (this.bomCheck) {
      switch(true) {
        case (chunk.length > 3 && chunk[0] === 0xEF && chunk[1] === 0xBB && chunk[2] === 0xBF): {
          this.options.encoding = 'utf-8';
          chunk = Buffer.copyBytesFrom(chunk, 3);
          break;
        }

        case (chunk.length > 2 && chunk[0] === 0xFE && chunk[1] === 0xFF): {
          this.options.encoding = 'binary'; // utf-16beがないので、binary
          chunk = Buffer.copyBytesFrom(chunk, 2);
          break;
        }

        case (chunk.length > 2 && chunk[0] === 0xFF && chunk[1] === 0xFE): {
          this.options.encoding = 'utf-16le';
          chunk = Buffer.copyBytesFrom(chunk, 2);
          break;
        }

        case (chunk.length > 4 && chunk[0] === 0x00 && chunk[1] === 0x00 && chunk[2] === 0xFE && chunk[3] === 0xFF): {
          this.options.encoding = 'binary'; // UTF-32(BE)がないので、binary
          chunk = Buffer.copyBytesFrom(chunk, 4);
          break;
        }

        case (chunk.length > 4 && chunk[0] === 0xFF && chunk[1] === 0xFE && chunk[2] === 0x00 && chunk[3] === 0x00): {
          this.options.encoding = 'binary'; // UTF-32(LE)がないので、binary
          chunk = Buffer.copyBytesFrom(chunk, 4);
          break;
        }

        default:
          // Do nothing here
          break;
      }

      this.bomCheck = false;
    }

    let hasSeparator = false;
    let prevIdx = 0;
    for (const [idx, charCode] of chunk.entries()) {
      switch(charCode) {
        case 0xD: {
          hasSeparator = true;
          break;
        }

        case 0xA: {
          hasSeparator = true;
          break;
        }

        default: {
          if (hasSeparator) {
            // 改行の連続は避ける
            if (idx - prevIdx > 1) {
              // 1つ前の行の残り + chunkの現在の位置までを結合して、pushする
              const prevBuffLen = this.prevBuffer ? this.prevBuffer.length : 0;
              const out = Buffer.alloc(prevBuffLen + idx - prevIdx - 1);
              if (this.prevBuffer) {
                this.prevBuffer.copy(out);
              }
              chunk.copy(out, prevBuffLen, prevIdx, idx - 1);
              this.push(out.toString(this.options.encoding));

              this.prevBuffer = null;
            }
            prevIdx = idx;
          }
          hasSeparator = false;
          break;
        }
      }
    }
    if (prevIdx !== chunk.length) {
      // chunkの最後にCR/LFがあるパターンもある。その場合は1行取り出す
      const tmpBuffer = chunk.subarray(prevIdx, chunk.length - (hasSeparator ? 1 : 0));
      if (hasSeparator) {
        this.push(tmpBuffer.toString(this.options.encoding));
        this.prevBuffer = null;
      } else {
        this.prevBuffer = tmpBuffer;
      }
    }
    callback();
  }

  _final(callback: (error?: Error | null) => void): void {
    if (this.prevBuffer) {
      this.push(this.prevBuffer.toString(this.options.encoding));
    }
    this.push(null);
    callback();
  }
}
