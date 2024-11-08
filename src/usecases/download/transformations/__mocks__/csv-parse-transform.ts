import { jest } from '@jest/globals';
import { Transform, TransformCallback } from 'node:stream';

class MockCsvParseTransform extends Transform {
  constructor(public params: any) {
    super({
      objectMode: true,
    });
  }

  _transform(chunk: any, _: BufferEncoding, callback: TransformCallback): void {
    callback(null, chunk); 
  }

  close() {}
}

// module.exports = {
//   CsvParseTransform,
// }

export const CsvParseTransform = jest.fn((params: any) => {
  return new MockCsvParseTransform(params);
});
