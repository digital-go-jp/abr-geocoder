import { Transform, TransformCallback } from "node:stream";
import { Query } from "../query.class";
import { FromStep3Type, FromStep3aType, ITown, InterpolatePattern, PrefectureName, getNormalizedCityParams } from "../types";
import { RegExpEx } from "../../../domain";
import { AddressFinder } from "../AddressFinder";

export class NormalizeStep3b extends Transform {
  constructor(
    private readonly addressFinder: AddressFinder,
  ) {
    super({
      objectMode: true,
    });
  }

  _transform(
    fromStep3a: FromStep3aType,
    encoding: BufferEncoding,
    next: TransformCallback,
  ): void {
    //
    // 都道府県名にマッチする場合は補完する
    //
    // オリジナルコード
    // https://github.com/digital-go-jp/abr-geocoder/blob/a42a079c2e2b9535e5cdd30d009454cddbbca90c/src/engine/normalize.ts#L339-L379
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
        address: matchedCity.input,
        prefecture: matchedCity.prefecture,
        cityName: matchedCity.city,
      });
      if (!normalized) {
        continue;
      }

      // 都道府県名が判別できた
      fromStep3a.fromStep3.query = fromStep3a.fromStep3.query.copy({
        prefectureName: matchedCity.prefecture,
        city: matchedCity.city
      })
      break;
    }

    next(null, fromStep3a.fromStep3);
  }
  
}