import { jest } from '@jest/globals';
import { Transform, TransformCallback } from 'node:stream';
import { DownloadTransformOptions } from '../download-transform';

export class DownloadTransform extends Transform {
  private constructor() {
    super({
      objectMode: true,
    });
  }
  initAsync = jest.fn();

  _transform(_: any, __: BufferEncoding, callback: TransformCallback): void {   
    callback(null, {
      kind: 'download',
      lgCode: '131016',
      dataset: 'city',
      useCache: false,
      package: 'ba-o1-131016_g2-000005',
      status: 'success',
      csvFiles: [
        {
          path: '131016.csv.zip',
          name: '131016.csv.zip',
          crc32: 12345,
          contentLength: 12345,
          lastModified: 12345,
          noUpdate: false,
        },
      ],
    });
  }

  close() {}

  static create = async (params: Required<DownloadTransformOptions>): Promise<DownloadTransform> => {
    const downloader = new DownloadTransform();
    await downloader.initAsync(params);
    return downloader;
  };
}
