import { Transform, TransformCallback } from 'node:stream';
import { Query } from '../query.class';
import { AddressFinderForStep3and5 } from '../AddressFinderForStep3and5';
import { number2kanji } from '@geolonia/japanese-numeral';
import {
  NUMRIC_AND_KANJI_SYMBOLS,
  SPACE_SYMBOLS,
  DASH_SYMBOLS,
  DASH,
} from '../../../domain/constantValues';
import { kan2num } from '../kan2num';
import { RegExpEx } from '../../../domain';

export class NormalizeStep5 extends Transform {
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

    // townが取得できた場合にのみ、addrに対する各種の変換処理を行う。
    const newAddress = query.tempAddress
      .replace(RegExpEx.create(`^${DASH}`), '')
      .replace(RegExpEx.create('[0-9]+)(丁目)', 'g'), match => {
        return match.replace(RegExpEx.create('([0-9]+)', 'g'), num => {
          return number2kanji(Number(num));
        });
      })
      .replace(
        new RegExp(
          `(([${NUMRIC_AND_KANJI_SYMBOLS}]+)(番地?)([${NUMRIC_AND_KANJI_SYMBOLS}]+)号)[${SPACE_SYMBOLS}]*(.+)`
        ),
        '$1 $5'
      )
      .replace(
        new RegExp(
          `([${NUMRIC_AND_KANJI_SYMBOLS}]+)(番地?)([${NUMRIC_AND_KANJI_SYMBOLS}]+)号?`
        ),
        `\$1${DASH}\$3`
      )
      .replace(new RegExp(`([${NUMRIC_AND_KANJI_SYMBOLS}]+)番地?`), '$1')
      .replace(new RegExp(`([${NUMRIC_AND_KANJI_SYMBOLS}]+)の?`), `$1${DASH}`)
      .replace(
        new RegExp(`([${NUMRIC_AND_KANJI_SYMBOLS}]+)[${DASH_SYMBOLS}]`, 'g'),
        match => {
          return kan2num(match).replace(
            new RegExp(`[${DASH_SYMBOLS}]`, 'g'),
            DASH
          );
        }
      )
      .replace(
        new RegExp(`[${DASH_SYMBOLS}]([${NUMRIC_AND_KANJI_SYMBOLS}]+)`, 'g'),
        match => {
          return kan2num(match).replace(
            new RegExp(`[${DASH_SYMBOLS}]`, 'g'),
            DASH
          );
        }
      )
      .replace(new RegExp(`([${NUMRIC_AND_KANJI_SYMBOLS}]+)${DASH}`), s => {
        // `1-` のようなケース
        return kan2num(s);
      })
      .replace(new RegExp(`${DASH}([${NUMRIC_AND_KANJI_SYMBOLS}]+)`), s => {
        // `-1` のようなケース
        return kan2num(s);
      })
      .replace(
        new RegExp(`${DASH}[^0-9]+([${NUMRIC_AND_KANJI_SYMBOLS}]+)`),
        s => {
          // `-あ1` のようなケース
          return kan2num(s);
        }
      )

      .replace(new RegExp(`([${NUMRIC_AND_KANJI_SYMBOLS}]+)`), s => {
        // `串本町串本１２３４` のようなケース
        return kan2num(s);
      })
      .trim();
    return query.copy({
      tempAddress: newAddress,
    });
  }

  private async findByCity(query: Query): Promise<Query> {
    const normalized = await this.addressFinder.find({
      address: query.tempAddress,
      prefecture: query.prefecture!,
      cityName: query.city!,
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
    });
  }
}
