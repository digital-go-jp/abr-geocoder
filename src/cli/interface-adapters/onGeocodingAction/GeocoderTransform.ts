import { Transform } from "node:stream";
import { TransformCallback } from "stream";

export class GeocoderTransform extends Transform {
  _transform(chunk: string, encoding: BufferEncoding, callback: TransformCallback): void {
    
    callback(null, `[start]${chunk}[end]\n`)
  }
}