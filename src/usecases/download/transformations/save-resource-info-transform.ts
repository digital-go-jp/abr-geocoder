import { DownloadProcessBase, DownloadProcessStatus, DownloadResult } from '@domain/models/download-process-query';
import { IDatasetDb } from '@drivers/database/dataset-db';
import { Transform, TransformCallback } from 'stream';


export class SaveResourceInfoTransform extends Transform {
  constructor(private readonly params: {
    datasetDb: IDatasetDb
  }) {
    super({
      objectMode: true,
    });
  }

  async _transform(chunk: DownloadProcessBase, _: BufferEncoding, callback: TransformCallback) {
    if (chunk.status !== DownloadProcessStatus.SUCCESS) {
      callback(null, chunk);
      return;
    }

    const downloadResult = chunk as DownloadResult;

    // ZIPファイルの情報をDBに保存
    await this.params.datasetDb.saveUrlCache({
      url: new URL(downloadResult.urlCache.url),
      content_length: downloadResult.urlCache.content_length,
      crc32: downloadResult.urlCache.crc32,
      last_modified: downloadResult.urlCache.last_modified || '',
      etag: downloadResult.urlCache.etag || '',
    });
    callback(null, downloadResult);
  }
}
