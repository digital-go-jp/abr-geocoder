
import { BREAK_AT_EOF } from '@config/constant-values';
import { Transform, TransformCallback } from 'node:stream';
export class ApiResponseTransform extends Transform {
  private buffer: string = '';
  private lineNum: number = 0;

  constructor() {
    super({
      // Data format coming from the previous stream is object mode.
      // Because we expect GeocodeResult
      writableObjectMode: true,

      // Data format to the next stream is non-object mode.
      // Because we output string as Buffer.
      readableObjectMode: false,
    });
  }
  _transform(
    result: string,
    _: BufferEncoding,
    callback: TransformCallback
  ): void {
    const out = this.buffer;

    if (this.lineNum === 0) {
      this.buffer = '{"status":"ok", "result":';
    } else {
      this.buffer = '';
    }
    this.lineNum++;
    this.buffer += result;
    callback(null, out);
  }

  _final(callback: (error?: Error | null | undefined) => void): void {
    this.emit('data', this.buffer);
    this.emit('data', '}');
    this.emit('data', BREAK_AT_EOF); // ファイルの最後に改行を入れる
    callback();
  }
}