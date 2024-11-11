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
import { RegExpEx } from '@domain/services/reg-exp-ex';

export class SimplifiedCsvTransform extends Stream.Transform implements IFormatTransform {

  mimetype: string = 'text/x-csv';

  private buffer: string = '';
  private readonly columns = [
    // 出力するCSVカラムの順番
    'input',
    'output',
    'score',
    'match_level',
  ];

  constructor(
    private readonly options: {
      skipHeader: boolean;
      debug?: boolean;
    },
  ) {
    super({
      // Data format coming from the previous stream is object mode.
      // Because we expect GeocodeResult
      writableObjectMode: true,

      // Data format to the next stream is non-object mode.
      // Because we output string as Buffer.
      readableObjectMode: false,

      highWaterMark: 3000,
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

    this.buffer = this.columns.map(column => column.toString()).join(',') + "\n";
  }

  _transform(
    result: Query,
    _: BufferEncoding,
    callback: TransformCallback,
  ): void {
    if (this.buffer) {
      this.push(this.buffer);
      this.buffer = '';
    }
    const line = this.columns
      .map(column => {
        switch (column) {
          case 'input': {
            // ダブルクォートを含む場合は、ダブルクォートは2つ並べて（""）エスケープする。
            const input = result.input.data.address.replaceAll(RegExpEx.create('"{1,2}', 'g'), '""');
            return `"${input}"`;
          }
          case 'output':
            return `"${result.formatted.address || ''}"`;
          case 'other':
            return `"${result.tempAddress?.toOriginalString().trim() || ''}"`;
          case 'score':
            return result.formatted.score;
          case 'match_level':
            return `"${result.match_level.str || ''}"`;
          case 'pref_key':
            return result.pref_key?.toString() || '';
          case 'city_key':
            return result.city_key?.toString() || '';
          case 'town_key':
            return result.town_key?.toString() || '';
          case 'parcel_key':
            return result.parcel_key || '';
          case 'rsdtblk_key':
            return result.rsdtblk_key || '';
          case 'rsdtdsp_key':
            return result.rsdtdsp_key || '';
          default:
            throw new Error(`Unimplemented field : ${column}`);
        }
      })
      .join(',');

    callback(null, `${line}\n`);
    this.buffer = '';

    result.release();
  }
}
