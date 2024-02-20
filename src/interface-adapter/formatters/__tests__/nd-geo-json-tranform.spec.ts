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
import { Stream } from 'node:stream';
import { NdGeoJsonTransform } from '../nd-geo-json-transform';
import { expectResults } from './data/expect-results';
import { testValues } from './data/test-values';

describe('NdGeoJsonTransform', () => {
  it('should output rows with expected JSON format()', async () => {
    const transform = NdGeoJsonTransform.create();

    const expectGeoJson = expectResults.map(expVal => {
      return {
        "type": "Feature",
        "geometry": {
          "type": "Point",
          "coordinates": [
            expVal.result.lon,
            expVal.result.lat,
          ]
        },
        "properties": {
          "query": {
            "input": expVal.query.input,
          },
          "result": {
            "output": expVal.result.output,
            "match_level": expVal.result.match_level,
            "prefecture": expVal.result.prefecture,
            "city": expVal.result.city,
            "town": expVal.result.town,
            "town_id": expVal.result.town_id,
            "lg_code": expVal.result.lg_code,
            "other": expVal.result.other,
            "block": expVal.result.block,
            "block_id": expVal.result.block_id,
            "addr1": expVal.result.addr1,
            "addr1_id": expVal.result.addr1_id,
            "addr2": expVal.result.addr2,
            "addr2_id": expVal.result.addr2_id,
          }
        }
      };
    });

    // クエリ毎に結果を results に溜めていく
    const buffer: string[] = [];
    const writable = new Stream.Writable({
      objectMode: true,
      write(chunk, encoding, callback) {
        buffer.push(chunk.toString());
        callback();
      },
    })
    const readStream = Stream.Readable.from(testValues);

    await Stream.promises.pipeline(
      readStream,
      transform,
      writable,
    )

    const results = buffer.join('').trim().split('\n').map(line => JSON.parse(line));

    expect(results.length).toBe(expectGeoJson.length);
    
    // 1オブジェクト単位で比較
    for (let i = 0; i < results.length; i++) {
      expect(results[i]).toEqual(expectGeoJson[i]);
    }
  });
});
