import { Transform, TransformCallback } from "node:stream";

export class ConsolidateTransform extends Transform {
  private buffer: unknown[] = [];
  constructor(private readonly N: number) {
    super({
      objectMode: true,
    });
  }
  _transform(chunk: unknown, _: BufferEncoding, callback: TransformCallback): void {
    if (this.buffer.length < this.N) {
      this.buffer.push(chunk);
      return callback()
    }
    this.buffer.push(chunk);
    const data = this.buffer;

    this.buffer = [];
    callback(null, data);
  }
  _final(callback: (error?: Error | null | undefined) => void): void {
    this.emit('data', this.buffer);
    callback(null);
  }
}