import { Transform, TransformCallback } from 'node:stream';

export class SaveResourceInfoTransform extends Transform {
  constructor(_params: any) {
    super({
      objectMode: true,
    });
  }

  _transform(_: any, __: BufferEncoding, callback: TransformCallback): void {   
    callback(null, {});
  }

  close() {}
}
