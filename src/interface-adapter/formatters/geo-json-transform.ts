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
import { BLANK_CHAR, BREAK_AT_EOF } from '@settings/constant-values';
import { Stream } from 'node:stream';
import { TransformCallback } from 'stream';

export class GeoJsonTransform extends Stream.Transform {
  private buffer: string = '';
  private lineNum: number = 0;

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
    const out = this.buffer;

    if (this.lineNum > 0) {
      this.buffer = ',';
    } else {
      this.buffer = '{"type":"FeatureCollection", "features":[';
    }
    this.lineNum++;
    this.buffer += JSON.stringify({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [result.lon, result.lat],
      },
      properties: {
        query: {
          input: result.input,
        },
        result: {
          output: result.output,
          match_level: result.match_level,
          prefecture: result.prefecture?.toString() ?? BLANK_CHAR,
          city: result.city ?? BLANK_CHAR,
          town: result.town ?? BLANK_CHAR,
          town_id: result.town_id ?? BLANK_CHAR,
          lg_code: result.lg_code ?? BLANK_CHAR,
          other: result.other ?? BLANK_CHAR,
          block: result.block ?? BLANK_CHAR,
          block_id: result.block_id ?? BLANK_CHAR,
          addr1: result.addr1 ?? BLANK_CHAR,
          addr1_id: result.addr1_id ?? BLANK_CHAR,
          addr2: result.addr2 ?? BLANK_CHAR,
          addr2_id: result.addr2_id ?? BLANK_CHAR,
        },
      },
    });
    callback(null, out);
  }

  _final(callback: (error?: Error | null | undefined) => void): void {
    this.emit('data', this.buffer);
    this.emit('data', ']}');
    this.emit('data', BREAK_AT_EOF); // ファイルの最後に改行を入れる
    callback();
  }

  static readonly create = (): GeoJsonTransform => {
    return new GeoJsonTransform();
  };
}
