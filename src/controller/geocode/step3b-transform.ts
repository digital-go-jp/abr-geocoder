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
import { FromStep3aType } from '@domain/from-step3a-type';
import { AddressFinderForStep3and5 } from '@domain/geocode/address-finder-for-step3and5';
import { MatchLevel } from '@domain/match-level';
import { Transform, TransformCallback } from 'node:stream';

export class GeocodingStep3B extends Transform {
  constructor(private readonly addressFinder: AddressFinderForStep3and5) {
    super({
      objectMode: true,
    });
  }

  _transform(
    fromStep3a: FromStep3aType,
    encoding: BufferEncoding,
    next: TransformCallback
  ): void {
    //
    // オリジナルコード
    // https://github.com/digital-go-jp/abr-geocoder/blob/a42a079c2e2b9535e5cdd30d009454cddbbca90c/src/engine/normalize.ts#L367-L378
    //
    this.internalProcess(fromStep3a, next);
  }

  private async internalProcess(
    fromStep3a: FromStep3aType,

    // move to step3b
    next: TransformCallback
  ) {
    // マッチする都道府県が複数ある場合は町名まで正規化して都道府県名を判別する
    //（例: 東京都府中市と広島県府中市など）
    for (const matchedCity of fromStep3a.matchedPatterns) {
      const normalized = await this.addressFinder.find({
        address: matchedCity.tempAddress,
        prefecture: matchedCity.prefecture,
        city: matchedCity.city,
      });
      if (!normalized) {
        continue;
      }

      // 都道府県名 + 市区町村名が判別できた
      fromStep3a.fromStep3.query = fromStep3a.fromStep3.query.copy({
        prefecture: matchedCity.prefecture,
        city: matchedCity.city,
        tempAddress: matchedCity.tempAddress,
        match_level: MatchLevel.ADMINISTRATIVE_AREA,
      });
      break;
    }

    next(null, fromStep3a.fromStep3);
  }
}
