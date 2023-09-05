import { Transform, TransformCallback } from 'node:stream';
import { Query } from '../query.class';
import { InterpolatePattern, PrefectureName } from '../types';

export class NormalizeStep4 extends Transform {
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
    // step3a で同じようなことをしているのに、する必要があるのか？
    //
    // オリジナルコード
    // https://github.com/digital-go-jp/abr-geocoder/blob/a42a079c2e2b9535e5cdd30d009454cddbbca90c/src/engine/normalize.ts#L380-L397
    //

    // すでに都道府県名がこのステップで分かっていないデータはスキップする
    if (!query.prefectureName) {
      return callback(null, query);
    }
    // cityが判別済みの場合はスキップ
    if (query.city) {
      return callback(null, query);
    }

    const cityPatterns = this.cityPatternsForEachPrefecture.get(
      query.prefectureName
    )!;

    for (const { regExpPattern, address } of cityPatterns) {
      const match = query.tempAddress.match(this.wildcardHelper(regExpPattern));
      if (!match) {
        continue;
      }
      query = query.copy({
        city: address,

        // 市区町村名以降の住所
        tempAddress: query.tempAddress.substring(match[0].length),
      });

      break;
    }

    callback(null, query);
  }
}
