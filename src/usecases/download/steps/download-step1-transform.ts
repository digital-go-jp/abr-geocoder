/*!
 * MIT License
 *
 * Copyright (c) 2024 デジタル庁
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { DownloadProcessError, DownloadProcessSkip, DownloadProcessStatus, DownloadQuery1, DownloadQuery2 } from '@domain/models/download-process-query';
import crc32 from '@domain/services/crc32-lib';
import { ThreadJob, ThreadJobResult } from '@domain/services/thread/thread-task';
import { IDatasetDb } from '@drivers/database/dataset-db';
import { HttpRequestAdapter } from '@interface/http-request-adapter';
import { StatusCodes } from 'http-status-codes';
import fs from 'node:fs';
import path from 'node:path';
import { Duplex } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export class DownloadStep1Transform extends Duplex {

  constructor(private readonly params: Required<{
    client: HttpRequestAdapter;
    datasetDb: IDatasetDb;
    downloadDir: string;
    highWaterMark: number;
  }>) {
    super({
      objectMode: true,
      allowHalfOpen: true,
      read() {},
      highWaterMark: params.highWaterMark,
    });
  }
  
  async _write(
    job: ThreadJob<DownloadQuery1>,
    _: BufferEncoding,
    callback: (error?: Error | null | undefined) => void,
  ) {
    // 次のリクエストをもらうために、先にCallbackを呼ぶ
    callback();
    
    // 同時並行ダウンロード
    const response = await this.downloadResource({
      job,
    });
    this.push(response);
  }

  private async downloadResource({
    job,
  }: {
    job: ThreadJob<DownloadQuery1>,
  }): Promise<ThreadJobResult<DownloadProcessError | DownloadQuery2 | DownloadProcessSkip>> {

    // packageIdが直接CSV.ZIPのURL
    const csvUrl = new URL(job.data.packageId);

    // DBからキャッシュ情報の読込
    const cache = await this.params.datasetDb.readUrlCache(csvUrl);

    // キャッシュがあり、最終更新日が一致する場合はスキップ（HEADリクエスト不要）
    if (job.data.useCache && cache && job.data.lastModified) {
      if (cache.last_modified === job.data.lastModified) {
        return {
          taskId: job.taskId,
          kind: 'result',
          data: {
            dataset: job.data.dataset,
            status: DownloadProcessStatus.SKIP,
            message: 'skipped',
          },
        } as ThreadJobResult<DownloadProcessSkip>;
      }
    }

    // サーバーからリソース(zipファイル)をダウンロード
    const zipFilename = path.basename(csvUrl.toString());
    const zipFilePath = path.join(this.params.downloadDir, zipFilename);

    // リソースをダウンロードする
    const src = await this.params.client.getReadableStream({
      url: csvUrl,
    });

    // ファイルに保存する
    const dst = fs.createWriteStream(zipFilePath);

    await pipeline(
      src,
      dst,
    );
    const fileCrc32 = await crc32.fromFile(zipFilePath)!;
    const fileStats = await fs.promises.stat(zipFilePath);

    return {
      taskId: job.taskId,
      data: {
        dataset: job.data.dataset,
        zipFilePath,
        status: DownloadProcessStatus.UNSET,
        urlCache: {
          url: csvUrl,
          etag: '',
          last_modified: job.data.lastModified || fileStats.mtime.toUTCString(),
          content_length: fileStats.size,
          crc32: fileCrc32,
        },
      },
    } as ThreadJobResult<DownloadQuery2>;
  }
}
