import { Writable } from "node:stream";

export class NormalizeStep3Final extends Writable {
  constructor() {
    super({
      objectMode: true,
    });
  }
  _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null | undefined) => void): void {
    
    callback();
    chunk.callback(null, chunk.query);
  }
}