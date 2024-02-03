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
import { MatchLevel } from '@domain/match-level';
import { Query } from '@domain/query';
import { AddressFinderForStep7 } from '@usecase/geocode/address-finder-for-step7';
import { Transform, TransformCallback } from 'node:stream';

export class GeocodingStep7 extends Transform {
  constructor(private readonly addressFinder: AddressFinderForStep7) {
    super({
      objectMode: true,
    });
  }

  _transform(
    query: Query,
    encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    //
    // 住居表示住所リストを使い番地号までの正規化を行う
    //
    // オリジナルコード
    // https://github.com/digital-go-jp/abr-geocoder/blob/a42a079c2e2b9535e5cdd30d009454cddbbca90c/src/engine/normalize.ts#L467-L478
    //
    if (!query.town) {
      return callback(null, query);
    }

    this.addressFinder.find(query).then(async (result: Query) => {
      switch (result.match_level) {
        case MatchLevel.RESIDENTIAL_BLOCK:
          return callback(null, await this.addressFinder.findDetail(result));

        case MatchLevel.TOWN_LOCAL:
          return callback(null, await this.addressFinder.findForKoaza(result));

        default:
          return callback(null, query);
      }

      // // RESIDENTIAL_BLOCK(7) or RESIDENTIAL_DETAIL(8) の場合は、
      // // 既に細かい住所まで判定できているので、これ以上のチェックは必要ない
      // //
      // // tempAddress に何も残っていないなら、調べようがないので、
      // // このステップを終了する
      // if (
      //   updatedQuery.match_level !== MatchLevel.TOWN_LOCAL ||
      //   updatedQuery.tempAddress === ''
      // ) {
      //   callback(null, updatedQuery);
      //   return;
      // }

      // // tempAddress に残っている場合、「小字」の可能性がある
      // //
      // // 例：福島県いわき市山玉町脇川
      // //   pref = "福島県"
      // //   city = "いわき市"
      // //   town = "山玉町"
      // //   tempAddress = "脇川"  <-- 小字
      // this.addressFinder.findForKoaza(query).then((result: Query) => {
      //   callback(null, result);
      //   return;
      // });
    });
  }
}
