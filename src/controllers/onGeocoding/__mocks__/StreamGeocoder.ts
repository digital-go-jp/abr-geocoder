import { PassThrough } from 'node:stream';

export class StreamGeocoder extends PassThrough {
  static create = async () => {
    return new PassThrough();
  };
}
