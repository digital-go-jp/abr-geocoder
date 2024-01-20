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
import csvtojson from 'csvtojson';
import { Stream } from 'node:stream';
import { NormalizeTransform } from '../normalize-transform';
import { dummyData } from './dummy-data';

describe('NormalizeTransform', () => {
  it('should output rows with expected CSV format()', async () => {
    const transform = NormalizeTransform.create(NormalizeTransform.DEFAULT_COLUMNS);

    const expectCsv = await csvtojson({
      output: 'csv',
    }).fromString([
      NormalizeTransform.DEFAULT_COLUMNS.join(','),
      [
        '"東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階"',
        '"東京都千代田区紀尾井町1-3 東京ガーデンテラス紀尾井町 19階、20階"',
        '8'
      ],
      [
        '"東京都千代田区紀尾井町1"',
        '"東京都千代田区紀尾井町1"',
        '7',
      ],
      [
        '"山形県山形市旅篭町二丁目3番25号"',
        '"山形県山形市旅篭町二丁目3-25"',
        '8'
      ],
      [
        '"山形市旅篭町二丁目3番25号"',
        '"山形県山形市旅篭町二丁目3-25"',
        '8',
      ],
      [
        '"東京都町田市森野2-2-22"',
        '"東京都町田市森野二丁目2-22"',
        '8'
      ]
    ].join("\n").trim());

    const buffer: string[] = [];
    const writable = new Stream.Writable({
      objectMode: true,
      write(chunk, encoding, callback) {
        buffer.push(chunk.toString());
        callback();
      },
    })
    const readStream = Stream.Readable.from(dummyData);

    await Stream.promises.pipeline(
      readStream,
      transform,
      writable,
    )

    const resultCSV = await csvtojson({
      output: 'csv',
    }).fromString(buffer.join('').trim());

    expect(resultCSV).toEqual(expectCsv);
  });
});
