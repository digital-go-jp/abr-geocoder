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
import { GeocodeResult } from '@domain/geocode-result';
import { Stream } from 'node:stream';
import { TransformCallback } from 'stream';

export class DebugBypass extends Stream.Transform {
  private constructor() {
    super({
      // Data format coming from the previous stream is object mode.
      // Because we expect GeocodeResult
      writableObjectMode: true,

      // Data format to the next stream is non-object mode.
      // Because we output string as Buffer.
      readableObjectMode: false,
    });
  }

  _transform(
    result: GeocodeResult,
    encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    callback(
      null,
      `new GeocodeResult(\n
      '${result.input}',
      '${result.output || ''}',
      ${result.match_level},
      ${result.lat || null},
      ${result.lon || null},
      '${result.other || ''}',
      ${result.prefecture ? "'" + result.prefecture + "'" : undefined},
      ${result.city ? "'" + result.city + "'" : undefined},
      ${result.town ? "'" + result.town + "'" : undefined},
      ${result.town_id ? "'" + result.town_id + "'" : undefined},
      ${result.lg_code ? "'" + result.lg_code + "'" : undefined},
      ${result.block ? "'" + result.block + "'" : undefined},
      ${result.block_id ? "'" + result.block_id + "'" : undefined},
      ${result.addr1 ? "'" + result.addr1 + "'" : undefined},
      ${result.addr1_id ? "'" + result.addr1_id + "'" : undefined},
      ${result.addr2 ? "'" + result.addr2 + "'" : undefined},
      ${result.addr2_id ? "'" + result.addr2_id + "'" : undefined},
    ),
\n`
    );
  }

  _final(callback: (error?: Error | null | undefined) => void): void {
    // this.emit('data', BREAK_AT_EOF); // _transform で改行を付けているので、改行を入れない
    callback();
  }

  static readonly create = (): DebugBypass => {
    return new DebugBypass();
  };
}
