import Stream, { Transform, TransformCallback } from 'node:stream';
import { Query } from '../query.class';

export class NormalizeStep3 extends Transform {
  constructor(private otherReadable: Stream.Readable) {
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
    // 都道府県名にマッチする場合は補完する
    //
    // オリジナルコード
    // https://github.com/digital-go-jp/abr-geocoder/blob/a42a079c2e2b9535e5cdd30d009454cddbbca90c/src/engine/normalize.ts#L339-L379
    //

    // すでに都道府県名が分かっている場合はスキップする
    if (query.prefecture) {
      return callback(null, query);
    }

    // 処理が複雑なので、別のストリームで処理する
    this.otherReadable.push({
      query,
      callback,
    });
  }

  _final(callback: (error?: Error | null | undefined) => void): void {
    // send the end signal
    this.otherReadable.push(null);
    callback();
  }
}
