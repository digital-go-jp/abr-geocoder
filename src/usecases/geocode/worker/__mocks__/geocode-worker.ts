import { jest } from '@jest/globals';
import { Duplex } from 'node:stream';
import { TransformCallback } from 'stream';

export class MockGeocodeTransform extends Duplex {
  name = "test";

  constructor() {
    super({
      objectMode: true,
      allowHalfOpen: true,
      read() { },
    });
  }

  _write = jest.fn(Duplex.prototype._write)
    .mockImplementation((chunk: any, _: BufferEncoding, callback: TransformCallback) => {
      callback();
      this.push({
        input: chunk,
        toJSON: () => {
          return {
            input: chunk,
            dummy: 'dummy',
          };
        },
      });
    });
}

export const GeocodeTransform = {
  create: jest.fn().mockImplementation(() => {
    return Promise.resolve(new MockGeocodeTransform());
  }),
};
