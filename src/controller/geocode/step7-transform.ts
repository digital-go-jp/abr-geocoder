import { AddressFinderForStep7 } from '@domain/geocode/address-finder-for-step7';
import { Query } from '@domain/query';
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

    this.addressFinder.find(query).then((updatedQuery: Query) => {
      callback(null, updatedQuery);
    });
  }
}
