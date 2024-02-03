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
import { kan2num } from '@domain/kan2num';
import { MatchLevel } from '@domain/match-level';
import { Query } from '@domain/query';
import { RegExpEx } from '@domain/reg-exp-ex';
import {
  DASH,
  J_DASH,
  NUMRIC_AND_KANJI_SYMBOLS,
  SPACE,
} from '@settings/constant-values';
import { AddressFinderForStep3and5 } from '@usecase/geocode/address-finder-for-step3and5';
import { Transform, TransformCallback } from 'node:stream';

export class GeocodingStep5 extends Transform {
  constructor(private readonly addressFinder: AddressFinderForStep3and5) {
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
    // 町丁目以降の正規化
    //
    // オリジナルコード
    // https://github.com/digital-go-jp/abr-geocoder/blob/a42a079c2e2b9535e5cdd30d009454cddbbca90c/src/engine/normalize.ts#L399-L463
    //

    // すでにcityがこのステップで分かっていないデータはスキップする
    if (!query.city) {
      return callback(null, query);
    }

    this.findByCity(query)
      .then(this.normalization)
      .then((query: Query) => {
        callback(null, query);
      });
  }

  private async normalization(query: Query): Promise<Query> {
    if (!query.town) {
      return query;
    }

    // townが取得できた場合にのみ、addrに対する各種の変換処理を行う
    let tempAddress = kan2num(query.tempAddress);
    tempAddress = tempAddress.replace(RegExpEx.create(`^${DASH}`), '');

    // tempAddress = tempAddress.replace(
    //   RegExpEx.create('([0-9]+)(丁目)', 'g'),
    //   match => {
    //     return match.replace(RegExpEx.create('([0-9]+)', 'g'), num => {
    //       return number2kanji(Number(num));
    //     });
    //   }
    // );

    tempAddress = tempAddress.replace(
      RegExpEx.create(
        `(([${NUMRIC_AND_KANJI_SYMBOLS}]+)(番地?)([${NUMRIC_AND_KANJI_SYMBOLS}]+)号)[${SPACE}]*(.+)`
      ),
      '$1' + SPACE + '$5'
    );

    tempAddress = tempAddress.replace(
      RegExpEx.create(
        `([${NUMRIC_AND_KANJI_SYMBOLS}]+)(番地?)([${NUMRIC_AND_KANJI_SYMBOLS}]+)号?`
      ),
      '$1' + DASH + '$3'
    );

    tempAddress = tempAddress.replace(
      RegExpEx.create(`([${NUMRIC_AND_KANJI_SYMBOLS}]+)番地?`),
      '$1'
    );

    tempAddress = tempAddress.replace(
      RegExpEx.create(`([${NUMRIC_AND_KANJI_SYMBOLS}]+)[${J_DASH}]`),
      '$1' + DASH
    );

    tempAddress = tempAddress.replace(
      RegExpEx.create(`([${NUMRIC_AND_KANJI_SYMBOLS}]+)${DASH}`, 'g'),
      match => {
        return kan2num(match);
      }
    );

    tempAddress = tempAddress.replace(
      RegExpEx.create(`${DASH}([${NUMRIC_AND_KANJI_SYMBOLS}]+)`, 'g'),
      match => {
        return kan2num(match);
      }
    );

    tempAddress = tempAddress.replace(
      RegExpEx.create(`([${NUMRIC_AND_KANJI_SYMBOLS}]+)${DASH}`),
      s => {
        // `1-` のようなケース
        return kan2num(s);
      }
    );

    tempAddress = tempAddress.replace(
      RegExpEx.create(`${DASH}([${NUMRIC_AND_KANJI_SYMBOLS}]+)`),
      s => {
        // `-1` のようなケース
        return kan2num(s);
      }
    );

    tempAddress = tempAddress.replace(
      RegExpEx.create(`${DASH}[^0-9]+([${NUMRIC_AND_KANJI_SYMBOLS}]+)`),
      s => {
        // `-あ1` のようなケース
        return kan2num(s);
      }
    );

    tempAddress = tempAddress.replace(
      RegExpEx.create(`([${NUMRIC_AND_KANJI_SYMBOLS}]+)$`),
      s => {
        // `串本町串本１２３４` のようなケース
        return kan2num(s);
      }
    );

    return query.copy({
      tempAddress: tempAddress.trim(),
    });
  }

  private async findByCity(query: Query): Promise<Query> {
    const normalized = await this.addressFinder.find({
      address: query.tempAddress,
      prefecture: query.prefecture!,
      city: query.city!,
    });

    if (!normalized) {
      return query;
    }

    return query.copy({
      // 町字の情報
      town_id: normalized.town_id,
      town: normalized.name,

      tempAddress: normalized.tempAddress,

      // 町字レベルでの緯度経度
      lat: normalized.lat,
      lon: normalized.lon,

      lg_code: normalized.lg_code,

      // 町字まで判別できた
      match_level: MatchLevel.TOWN_LOCAL,
    });
  }
}
