import { jest } from '@jest/globals';
import { Transform, TransformCallback } from 'node:stream';

class MockCsvParseTransform extends Transform {
  constructor() {
    super({
      objectMode: true,
    });
  }

  _transform(_: any, __: BufferEncoding, callback: TransformCallback): void {
    callback(null); 
  }

  close() {}
}

export const CsvParseTransform = jest.fn().mockImplementation(() => {
  return new MockCsvParseTransform();
});
