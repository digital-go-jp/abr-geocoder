import { jest } from '@jest/globals';
import { Transform, TransformCallback } from 'node:stream';
import { CsvParseTransformOptions } from '../csv-parse-transform';

export class CsvParseTransform extends Transform {
  private constructor() {
    super({
      objectMode: true,
    });
  }

  initAsync = jest.fn();

  _transform(chunk: any, _: BufferEncoding, callback: TransformCallback): void {
    callback(null, chunk); 
  }

  close() {}
  
  static readonly create = async (params : Required<CsvParseTransformOptions>): Promise<CsvParseTransform> => {
    const transform = new CsvParseTransform();
    await transform.initAsync(params);
    return transform;
  };
}

