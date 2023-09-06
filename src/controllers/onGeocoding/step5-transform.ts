import { number2kanji } from '@geolonia/japanese-numeral';
import { Transform, TransformCallback } from 'node:stream';
import { Query, RegExpEx } from '../../domain';
import { kan2num } from '../../domain/kan2num';
import {
  DASH,
  NUMRIC_AND_KANJI_SYMBOLS,
  SPACE,
  J_DASH,
} from '../../settings/constantValues';
import { AddressFinderForStep3and5 } from '../../usecase';

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
    let tempAddress = query.tempAddress;
    tempAddress = tempAddress.replace(RegExpEx.create(`^${DASH}`), '');

    tempAddress = tempAddress.replace(
      RegExpEx.create('([0-9]+)(丁目)', 'g'),
      match => {
        return match.replace(RegExpEx.create('([0-9]+)', 'g'), num => {
          return number2kanji(Number(num));
        });
      }
    );

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
      RegExpEx.create(`([${NUMRIC_AND_KANJI_SYMBOLS}]+)`),
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
      town_id: normalized.town_id,
      town: normalized.name,
      tempAddress: normalized.tempAddress,
      lat: normalized.lat,
      lon: normalized.lon,
      lg_code: normalized.lg_code,
    });
  }
}
