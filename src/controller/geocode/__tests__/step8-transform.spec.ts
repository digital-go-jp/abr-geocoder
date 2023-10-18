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
import { Query } from '@domain/query';
import { beforeAll, describe, expect, it } from '@jest/globals';
import { DASH, SPACE } from '@settings/constant-values';
import Stream from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { GeocodingStep8 } from '../step8-transform';
import { WritableStreamToArray } from './stream-to-array.skip';

describe('step8-transform', () => {
  const outputWrite = new WritableStreamToArray<Query>();
  const source = [
    Query.create(`   ${DASH}111${SPACE}11${SPACE}aa${SPACE}a${DASH} `).copy({
      tempAddress: `   ${DASH}111${SPACE}11${SPACE}aa${SPACE}a${DASH} `,
    }),
  ];

  const target = new GeocodingStep8();

  beforeAll(async () => {
    await pipeline(
      Stream.Readable.from(source, {
        objectMode: true,
      }),
      target,
      outputWrite
    );
  })

  it('DASH, SPACEが正しく置換されるはず', async () => {
    const results = outputWrite.toArray();
    expect(results.length).toBe(source.length);
    expect(results[0]).toEqual(Query.create(`   ${DASH}111${SPACE}11${SPACE}aa${SPACE}a${DASH} `).copy({
      tempAddress: `-111 11 aa a-`,
    }));
  });
});
