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
import { InterpolatePattern } from '@domain/interpolate-pattern';
import { MatchLevel } from '@domain/match-level';
import { PrefectureName } from '@domain/prefecture-name';
import { Query } from '@domain/query';
import { Transform, TransformCallback } from 'node:stream';

export class GeocodingStep4 extends Transform {
  private readonly cityPatternsForEachPrefecture: Map<
    PrefectureName,
    InterpolatePattern[]
  >;
  private readonly wildcardHelper: (address: string) => string;

  constructor({
    cityPatternsForEachPrefecture,
    wildcardHelper,
  }: {
    cityPatternsForEachPrefecture: Map<PrefectureName, InterpolatePattern[]>;
    wildcardHelper: (address: string) => string;
  }) {
    super({
      objectMode: true,
    });
    this.cityPatternsForEachPrefecture = cityPatternsForEachPrefecture;
    this.wildcardHelper = wildcardHelper;
  }

  _transform(
    query: Query,
    encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    //
    // オリジナルコード
    // https://github.com/digital-go-jp/abr-geocoder/blob/a42a079c2e2b9535e5cdd30d009454cddbbca90c/src/engine/normalize.ts#L380-L397
    //

    // すでに都道府県名がこのステップで分かっていないデータはスキップする
    if (!query.prefecture) {
      return callback(null, query);
    }
    // cityが判別済みの場合はスキップ
    if (query.city) {
      return callback(null, query);
    }

    const cityPatterns = this.cityPatternsForEachPrefecture.get(
      query.prefecture
    )!;

    for (const { regExpPattern, city } of cityPatterns) {
      const match = query.tempAddress.match(this.wildcardHelper(regExpPattern));
      if (!match) {
        continue;
      }

      query = query.copy({
        city,

        // 市区町村名が判別できた
        match_level: MatchLevel.ADMINISTRATIVE_AREA,

        // 市区町村名以降の住所
        tempAddress: query.tempAddress.substring(match[0].length),
      });

      break;
    }

    callback(null, query);
  }
}
