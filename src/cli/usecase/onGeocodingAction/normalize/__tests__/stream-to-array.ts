import { Stream } from "node:stream";
export class WritableStreamToArray<T> extends Stream.Writable {
  private readonly buffer: T[] = [];

  constructor() {
    super({
      objectMode: true,
    })
  }
  
  reset() {
    this.buffer.length = 0;
  }
  
  _write(chunk: T, encoding: BufferEncoding, callback: (error?: Error | null | undefined) => void): void {
    this.buffer.push(chunk);
    callback();
  }

  toArray(): T[] {
    return this.buffer;
  }
}