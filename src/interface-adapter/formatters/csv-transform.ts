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
import { GeocodeResult, GeocodeResultFields } from '@domain/geocode-result';
import { RegExpEx } from '@domain/reg-exp-ex';
import { DOUBLE_QUOTATION } from '@settings/constant-values';
import { Stream } from 'node:stream';
import { TransformCallback } from 'stream';

export class CsvTransform extends Stream.Transform {
  private readonly rows: string[] = [];

  private constructor(
    private readonly options: {
      columns: GeocodeResultFields[];
      skipHeader: boolean;
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
    if (!this.options.skipHeader) {
      const header = this.options.columns
        .map(column => `"${column.toString()}"`)
        .join(',');
      this.rows.push(header);
    }
  }

  _transform(
    result: GeocodeResult,
    encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    const line = this.options.columns
      .map(column => {
        let value = result[column];

        if (value === null || value === undefined) {
          value = '';
        } else {
          value = value
            .toString()
            .replace(RegExpEx.create(DOUBLE_QUOTATION, 'g'), '""');
        }

        return `"${value}"`;
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

  static DEFAULT_COLUMNS = [
    // 出力するCSVカラムの順番
    GeocodeResultFields.INPUT,
    GeocodeResultFields.OUTPUT,
    GeocodeResultFields.MATCH_LEVEL,
    GeocodeResultFields.LG_CODE,
    GeocodeResultFields.PREFECTURE,
    GeocodeResultFields.CITY,
    GeocodeResultFields.TOWN,
    GeocodeResultFields.TOWN_ID,
    GeocodeResultFields.BLOCK,
    GeocodeResultFields.BLOCK_ID,
    GeocodeResultFields.ADDR1,
    GeocodeResultFields.ADDR1_ID,
    GeocodeResultFields.ADDR2,
    GeocodeResultFields.ADDR2_ID,
    GeocodeResultFields.OTHER,
    GeocodeResultFields.LATITUDE,
    GeocodeResultFields.LONGITUDE,
  ];

  static create = (
    columns: GeocodeResultFields[] = this.DEFAULT_COLUMNS
  ): CsvTransform => {
    return new CsvTransform({
      skipHeader: false,
      columns,
    });
  };
}
