import { AddressFinderForStep3and5, FromStep3aType, MatchLevel } from '@domain';
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
