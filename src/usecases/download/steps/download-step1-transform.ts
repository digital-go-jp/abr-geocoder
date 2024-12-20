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
import { DownloadProcessError, DownloadProcessStatus, DownloadQuery1, DownloadQuery2 } from '@domain/models/download-process-query';
import crc32 from '@domain/services/crc32-lib';
import { getUrlHash } from '@domain/services/get-url-hash';
import { ThreadJob, ThreadJobResult } from '@domain/services/thread/thread-task';
import { UrlCacheManager } from '@domain/services/url-cache-manager';
import { CkanPackageResponse, CkanResource } from '@domain/types/download/ckan-package';
import { HttpRequestAdapter } from '@interface/http-request-adapter';
import { StatusCodes } from 'http-status-codes';
import fs from 'node:fs';
import path from 'node:path';
import { Duplex } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export class DownloadStep1Transform extends Duplex {

  constructor(private readonly params: Required<{
    client: HttpRequestAdapter;
    urlCacheMgr: UrlCacheManager;
    downloadDir: string;
    fileShowUrl: string;
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
    // 同時並行ダウンロード
    const response = await this.downloadResource({
      job,
    });
    this.push(response);
    callback();
  }

  private async downloadResource({
    job,
  }: {
    job: ThreadJob<DownloadQuery1>,
  }): Promise<ThreadJobResult<DownloadProcessError | DownloadQuery2>> {

    // リソースのURL
    const packageInfoUrl = `${this.params.fileShowUrl}?id=${job.data.packageId}`;
    
    // メタデータを取得
    const packageResponse = await this.params.client.getJSON({
      url: packageInfoUrl,
    });

    // リソースが利用できない (404 Not found)
    if (packageResponse.header.statusCode !== StatusCodes.OK) {
      return {
        kind: 'result',
        taskId: job.taskId,
        data: {
          lgCode: job.data.lgCode,
          status: DownloadProcessStatus.ERROR,
          dataset: job.data.dataset,
          message: `status: ${packageResponse.header.statusCode}`,
        },
      } as ThreadJobResult<DownloadProcessError>;
    }

    // CSVファイルのURLを抽出する
    const packageInfo = packageResponse.body as unknown as CkanPackageResponse;
    const csvMeta: CkanResource | undefined = packageInfo.result!.resources
      .find(x =>
        x.format.toLowerCase().startsWith('csv'),
      );

    // CSVがない (予防的なコード)
    if (!csvMeta) {
      return {
        taskId: job.taskId,
        kind: 'result',
        data: {
          dataset: job.data.dataset,
          message: 'can not find the csv resource',
          status: DownloadProcessStatus.ERROR,
        },
      } as ThreadJobResult<DownloadProcessError>;
    }
    
    // URLに対するハッシュ文字列の生成
    const urlHash = getUrlHash(csvMeta.url);
    const headers: {
      'if-none-match': string | undefined;
    } = {
      'if-none-match': '',
    };

    // キャッシュを利用する場合、利用できるか確認する
    if (job.data.useCache) {
      // DBからキャッシュ情報の読込
      const cache = await this.params.urlCacheMgr.readCache({
        key: urlHash,
      });
      headers['if-none-match'] = cache?.etag;
    }

    // ETagによるチェック
    const headResponse = await this.params.client.headRequest({
      url: csvMeta.url,
      headers,
    });

    if (job.data.useCache) {
      // DBからキャッシュ情報の読込
      const cache = await this.params.urlCacheMgr.readCache({
        key: urlHash,
      });

      if (cache && headResponse.header.statusCode === StatusCodes.NOT_MODIFIED) {

        const cacheFilePath = path.join(this.params.downloadDir, cache.cache_file);

        // キャッシュファイルのcrc32 が一致する場合、コンテンツとして返す
        const cacheFileHash = await crc32.fromFile(cacheFilePath);
        if (cache.crc32 === cacheFileHash) {
          return {
            taskId: job.taskId,
            data: {
              dataset: job.data.dataset,
              csvFilePath: cacheFilePath,
              noUpdate: true,
              status: DownloadProcessStatus.UNSET,
            },
          } as ThreadJobResult<DownloadQuery2>;
        }
      }
    }

    // サーバーからリソース(zipファイル)をダウンロード
    const csvFilename = path.basename(csvMeta.url);
    const csvFilePath = path.join(this.params.downloadDir, csvFilename);

    // リソースをダウンロードする
    const src = await this.params.client.getReadableStream({
      url: csvMeta.url,
    });

    // ファイルに保存する
    const dst = fs.createWriteStream(csvFilePath);

    await pipeline(
      src,
      dst,
    );
    const fileCrc32 = await crc32.fromFile(csvFilePath)!;

    // キャッシュに情報を保存する
    await this.params.urlCacheMgr.writeCache({
      key: urlHash,
      url: csvMeta.url,
      cache_file: csvFilename,
      etag: headResponse.header.eTag,
      last_modified: headResponse.header.lastModified,
      content_length: headResponse.header.contentLength,
      crc32: fileCrc32,
    });
    
    return {
      taskId: job.taskId,
      data: {
        dataset: job.data.dataset,
        csvFilePath,
        noUpdate: false,
        status: DownloadProcessStatus.UNSET,
      },
    } as ThreadJobResult<DownloadQuery2>;
  }
}
