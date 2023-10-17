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
import { Query } from '@domain/query';
import { RegExpEx } from '@domain/reg-exp-ex';
import { Transform, TransformCallback } from 'node:stream';

export class GeocodingStep2 extends Transform {
  constructor(
    private readonly params: {
      prefPatterns: InterpolatePattern[];
      sameNamedPrefPatterns: InterpolatePattern[];
    }
  ) {
    super({
      objectMode: true,
    });
  }

  _transform(
    query: Query,
    encoding: BufferEncoding,
    next: TransformCallback
  ): void {
    //
    // 県名が省略されており、かつ、市町村名の名前がどこかの都道府県名と同じ場合(例.千葉県千葉市)、
    // すぐに判断してしまう
    //
    // オリジナルコード
    // https://github.com/digital-go-jp/abr-geocoder/blob/a42a079c2e2b9535e5cdd30d009454cddbbca90c/src/engine/normalize.ts#L316-L326
    //
    for (const pattern of this.params.sameNamedPrefPatterns) {
      const match = query.tempAddress.match(
        RegExpEx.create(pattern.regExpPattern)
      );
      if (!match) {
        continue;
      }
      query = query.copy({
        // マッチレベル = 都道府県 + 市区町村
        match_level: MatchLevel.ADMINISTRATIVE_AREA,

        // 都道府県は分かっている
        prefecture: pattern.prefecture,

        // 市町村名も分かっている
        city: pattern.city,

        // 市町村名より後方の住所のみを残す
        tempAddress: query.tempAddress.substring(match[0].length),
      });
      return next(null, query);
    }

    //
    // 都道府県名でヒットできるか試みる
    // オリジナルコード
    // https://github.com/digital-go-jp/abr-geocoder/blob/a42a079c2e2b9535e5cdd30d009454cddbbca90c/src/engine/normalize.ts#L328-L337
    //
    for (const pattern of this.params.prefPatterns) {
      const match = query.tempAddress.match(
        RegExpEx.create(pattern.regExpPattern)
      );
      if (!match) {
        continue;
      }
      query = query.copy({
        // マッチレベル = 都道府県
        match_level: MatchLevel.PREFECTURE,

        // 都道府県は分かっている
        prefecture: pattern.prefecture,

        // 市町村名より後方の住所のみを残す
        tempAddress: query.tempAddress.substring(match[0].length),
      });
      return next(null, query);
    }

    // どちらのパターンにもマッチしないケース
    return next(null, query);
  }
}
