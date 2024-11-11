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

export class CsvTransform extends Stream.Transform implements IFormatTransform {
  mimetype: string = 'text/x-csv';

  private buffer: string = '';
  private readonly columns: string[];

  constructor(
    options: {
      columns: string[];
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

      highWaterMark: 1000,
    });
    this.columns = Array.from(options.columns);

    if (options.debug) {
      this.columns.push('pref_key');
      this.columns.push('city_key');
      this.columns.push('town_key');
      this.columns.push('parcel_key');
      this.columns.push('rsdtblk_key');
      this.columns.push('rsdtdsp_key');
      this.columns.push('spend_time');
    }

    if (options.skipHeader) {
      return;
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
    }

    this.buffer = this.columns
      .map(column => {
        switch (column) {
          case 'id':
            return result.input.taskId;

          case 'input': {
            // ダブルクォートを含む場合は、ダブルクォートは2つ並べて（""）エスケープする。
            const input = result.input.data.address.replaceAll(RegExpEx.create('"{1,2}', 'g'), '""');
            return `"${input}"`;
          }

          case 'output':
            return `"${result.formatted.address}"`;

          case 'score':
            return result.formatted.score;

          case 'match_level':
            return result.match_level.str;

          case 'lat':
            return result.rep_lat || '';

          case 'lon':
            return result.rep_lon || '';

          case 'pref':
            return result.pref || '';

          case 'city':
            return result.city || '';

          case 'lg_code':
            return `"${result.lg_code || ''}"`;

          case 'county':
            return result.county || '';

          case 'ward':
            return result.ward || '';

          case 'machiaza_id':
            return `"${result.machiaza_id || ''}"`;

          case 'oaza_cho':
            return result.oaza_cho || '';

          case 'chome':
            return result.chome || '';

          case 'koaza':
            return result.koaza || '';

          case 'rsdt_addr_flg':
            return result.rsdt_addr_flg;

          case 'others':
            if (!result.tempAddress && result.unmatched.length === 0) {
              return '';
            }
            if (result.tempAddress) {
              result.unmatched.push(result.tempAddress.toOriginalString().trim());
            }
            return `"${result.unmatched.join(',')}"`;

          case 'blk_num':
            return result.block?.toString() || '';

          case 'blk_id':
            return result.block_id?.toString() || '';

          case 'rsdt_id':
            return result.rsdt_id?.toString() || '';

          case 'rsdt_num':
            return result.rsdt_num?.toString() || '';

          case 'rsdt2_id':
            return result.rsdt2_id?.toString() || '';

          case 'rsdt_num2':
            return result.rsdt_num2?.toString() || '';

          case 'prc_num1':
            return result.prc_num1?.toString() || '';

          case 'prc_num2':
            return result.prc_num2?.toString() || '';

          case 'prc_num3':
            return result.prc_num3?.toString() || '';

          case 'prc_id':
            return result.prc_id?.toString() || '';

          case 'coordinate_level':
            return result.coordinate_level.str;

          case 'pref_key':
            return result.pref_key || '';

          case 'city_key':
            return result.city_key || '';

          case 'town_key':
            return result.town_key || '';

          case 'parcel_key':
            return result.parcel_key || '';

          case 'rsdtblk_key':
            return result.rsdtblk_key || '';

          case 'rsdtdsp_key':
            return result.rsdtdsp_key || '';

          case 'spend_time':
            return ((Date.now() - result.startTime) / 1000).toFixed(2);

          default:
            throw new Error(`Unimplemented field : ${column}`);
        }
      })
      .join(',');


    result.release();
    callback(null, `${this.buffer}\n`);
    this.buffer = '';
  }

  static readonly DEFAULT_COLUMNS = [
    // 出力するCSVカラムの順番
    'input',
    'output',
    'others',
    'score',
    'match_level',
    'coordinate_level',
    'lat',
    'lon',
    'lg_code',
    'machiaza_id',
    'rsdt_addr_flg',
    'blk_id',
    'rsdt_id',
    'rsdt2_id',
    'prc_id',
    'pref',
    'county',
    'city',
    'ward',
    'oaza_cho',
    'chome',
    'koaza',
    'blk_num',
    'rsdt_num',
    'rsdt_num2',
    'prc_num1',
    'prc_num2',
    'prc_num3',
  ];
}
