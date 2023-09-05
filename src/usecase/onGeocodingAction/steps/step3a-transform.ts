import { Transform, TransformCallback } from 'node:stream';
import {
  FromStep3Type,
  InterpolatePattern,
  PrefectureName,
  Step3aMatchedPatternType,
} from '../types';

export class NormalizeStep3a extends Transform {
  constructor(
    private cityPatternsForEachPrefecture: Map<
      PrefectureName,
      InterpolatePattern[]
    >
  ) {
    super({
      objectMode: true,
    });
  }

  _transform(
    fromStep3: FromStep3Type,
    encoding: BufferEncoding,
    next: TransformCallback
  ): void {
    //
    // 都道府県名にマッチする場合は補完する
    //
    // オリジナルコード
    // https://github.com/digital-go-jp/abr-geocoder/blob/a42a079c2e2b9535e5cdd30d009454cddbbca90c/src/engine/normalize.ts#L339-L379
    //

    this.internalProcess(fromStep3, next);
  }

  private async internalProcess(
    fromStep3: FromStep3Type,

    // move to step3b
    next: TransformCallback
  ) {
    // 市町村名から始まっている場合、異なる都道府県に同一名称の地域が存在するので、
    // マッチするパターンを探していく
    const matchedPatterns: Step3aMatchedPatternType[] = [];
    for (const [
      prefectureName,
      cityPatterns,
    ] of this.cityPatternsForEachPrefecture.entries()) {
      for (const cityPattern of cityPatterns) {
        const match = fromStep3.query.tempAddress.match(
          cityPattern.regExpPattern
        );

        if (!match) {
          continue;
        }

        matchedPatterns.push({
          prefecture: prefectureName,
          city: cityPattern.cityName!,
          input: fromStep3.query.tempAddress.substring(match[0].length),
        });
      }
    }

    if (matchedPatterns.length === 1) {
      fromStep3.query = fromStep3.query.copy({
        prefecture: matchedPatterns[0].prefecture,
        city: matchedPatterns[0].city,
      });

      // 都道府県名が判別できたので、step4に進む
      next(); // ストリームをつなげる必要があるので、next() を実行しておく

      // step4に進む
      return fromStep3.callback(null, fromStep3.query);
    }

    // 複数の都道府県にマッチした場合、町名まで正規化して都道府県名を判別する必要があるので
    // 次のステップにわたす
    //（例: 東京都府中市と広島県府中市など）
    next(null, {
      fromStep3,
      matchedPatterns,
    });
  }
}
