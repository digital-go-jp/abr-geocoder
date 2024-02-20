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
import { describe, expect, it } from '@jest/globals';
import byline from 'byline';
import { stringify } from 'csv-stringify/sync';
import { Stream } from 'node:stream';
import { CsvTransform } from '../csv-transform';
import { expectResults } from './data/expect-results';
import { testValues } from './data/test-values';
import { BREAK_AT_EOF } from '@settings/constant-values';

describe('CsvTransform', () => {
  it('should output rows with expected CSV format()', async () => {
    const transform = CsvTransform.create(CsvTransform.DEFAULT_COLUMNS);


    // 共通する期待値データ（expectResults）から必要なフィールドだけを拾って、
    // stringifyでCSVに変換。1行毎に区切る。
    const expectCsvLines = stringify([
      CsvTransform.DEFAULT_COLUMNS,
      ...expectResults.map(expVal => {
        return [
          expVal.query.input,
          expVal.result.output,
          expVal.result.match_level,
          expVal.result.lg_code,
          expVal.result.prefecture,
          expVal.result.city,
          expVal.result.town,
          expVal.result.town_id,
          expVal.result.block,
          expVal.result.block_id,
          expVal.result.addr1,
          expVal.result.addr1_id,
          expVal.result.addr2,
          expVal.result.addr2_id,
          expVal.result.other,
          expVal.result.lat,
          expVal.result.lon,
        ]
      })
    ]).split("\n");

    // stringifyが最後に空行を追加するので、排除する
    expect(expectCsvLines.at(-1)).toEqual('');
    expectCsvLines.pop();

    // 1行単位で results に溜めていく
    const results: string[] = [];
    const writable = new Stream.Writable({
      objectMode: true,
      write(chunk, encoding, callback) {
        results.push(chunk.toString());
        callback();
      },
    })
    const readStream = Stream.Readable.from(testValues);

    await Stream.promises.pipeline(
      readStream,
      transform,
      byline,
      writable,
    )

    expect(results.length).toBe(expectCsvLines.length);

    // 全体を比較すると検証しにくいので、１行単位で比較していく
    for (let i = 0; i < expectCsvLines.length; i++) {
      expect(results[i]).toBe(expectCsvLines[i]);
    }
  });
});
