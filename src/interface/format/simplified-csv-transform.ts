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

import { Query } from '@usecases/geocode/models/query';
import { Stream, TransformCallback } from 'node:stream';
import { IFormatTransform } from './iformat-transform';

export class SimplifiedCsvTransform extends Stream.Transform implements IFormatTransform {

  mimetype: string = 'text/x-csv';

  private readonly rows: string[] = [];
  private readonly columns = [
    // 出力するCSVカラムの順番
    'input',
    'output',
    'other',
    'score',
    'match_level',
  ];

  constructor(
    private readonly options: {
      skipHeader: boolean;
      debug?: boolean;
    }
  ) {
    super({
      // Data format coming from the previous stream is object mode.
      // Because we expect GeocodeResult
      writableObjectMode: true,

      // Data format to the next stream is non-object mode.
      // Because we output string as Buffer.
      readableObjectMode: false,
    });
    if (this.options.skipHeader) {
      return;
    }

    if (options.debug) {
      this.columns.push('pref_key');
      this.columns.push('city_key');
      this.columns.push('town_key');
      this.columns.push('parcel_key');
      this.columns.push('rsdtblk_key');
      this.columns.push('rsdtdsp_key');
    }

    this.rows.push(this.columns.map(column => column.toString()).join(','));
  }

  _transform(
    result: Query,
    _: BufferEncoding,
    callback: TransformCallback
  ): void {
    const line = this.columns
      .map(column => {
        switch (column) {
          case 'input':
            return `"${result.input.data.address}"`;
          case 'output':
            return `"${result.formatted.address || ''}"`;
          case 'other':
            return `"${result.tempAddress?.toOriginalString().trim() || ''}"`;
          case 'score':
            return result.formatted.score;
          case 'match_level':
            return `"${result.match_level.str || ''}"`;
          case 'pref_key':
            return result.pref_key;
          case 'city_key':
            return result.city_key;
          case 'town_key':
            return result.town_key;
          case 'parcel_key':
            return result.parcel_key;
          case 'rsdtblk_key':
            return result.rsdtblk_key;
          case 'rsdtdsp_key':
            return result.rsdtdsp_key;
          default:
            throw new Error(`Unimplemented field : ${column}`);
        }
      })
      .join(',');

    this.rows.push(line);
    this.rows.push('');
    const csvLines: string = this.rows.join('\n');
    this.rows.length = 0;

    callback(null, csvLines);
  }

  _final(callback: (error?: Error | null | undefined) => void): void {
    // this.emit('data', BREAK_AT_EOF); // _transform で改行を付けているので、改行を入れない
    callback();
  }

}
