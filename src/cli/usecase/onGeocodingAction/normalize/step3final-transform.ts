import { Writable } from 'node:stream';

export class NormalizeStep3Final extends Writable {
  constructor() {
    super({
      objectMode: true,
    });
  }
  _write(
    chunk: any,
    encoding: BufferEncoding,
    callback: (error?: Error | null | undefined) => void
  ): void {
    // ストリームの処理を完了させたあとに
    callback();

    // step3全体のcallbackを呼び出す
    // (stream3a,3b,3final用のストリームを都度生成していないので、doneイベントは発生しない)
    chunk.callback(null, chunk.query);
  }
}
