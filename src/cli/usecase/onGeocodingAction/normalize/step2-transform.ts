import { Transform, TransformCallback } from "node:stream";
import { Query } from "../query.class";
import { InterpolatePattern } from "../types";
import { RegExpEx } from "../../../domain";

export class NormalizeStep2 extends Transform {
  constructor(
    private sameNamedPrefPatterns: InterpolatePattern[],
  ) {
    super({
      objectMode: true,
    });
  }

  _transform(
    query: Query,
    encoding: BufferEncoding,
    next: TransformCallback
  ): void {
    //
    // 県名が省略されており、かつ、市町村名の名前がどこかの都道府県名と同じ場合(例.千葉県千葉市)、
    // すぐに判断してしまう
    //
    // オリジナルコード
    // https://github.com/digital-go-jp/abr-geocoder/blob/a42a079c2e2b9535e5cdd30d009454cddbbca90c/src/engine/normalize.ts#L316-L326
    //
    for (const pattern of this.sameNamedPrefPatterns) {
      const match = query.tempAddress.match(
        RegExpEx.create(pattern.regExpPattern),
      );
      if (!match) {
        continue;
      }
      query = query.copy({
        // 都道府県は分かっている
        prefectureName: pattern.prefectureName,

        // 市町村名も分かっている
        city: pattern.cityName,

        // 市町村名より後方の住所のみを残す
        tempAddress: query.tempAddress.substring(match[0].length),
      });
      break;
    }
    
    next(null, query);
  }
}