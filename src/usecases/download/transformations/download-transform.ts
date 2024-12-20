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
 */;
import { MAX_CONCURRENT_DOWNLOAD } from '@config/constant-values';
import { AbrAbortController } from '@domain/models/abr-abort-controller';
import { DownloadQueryBase, DownloadRequest, isDownloadProcessError } from '@domain/models/download-process-query';
import { WorkerThreadPool } from '@domain/services/thread/worker-thread-pool';
import { DownloadDiContainer } from '@usecases/download/models/download-di-container';
import { DownloadWorkerInitData } from '@usecases/download/workers/download-worker';
import path from 'node:path';
import { Duplex, TransformCallback } from 'node:stream';
import timers from 'node:timers/promises';

export class DownloadTransform extends Duplex {

  private receivedFinal: boolean = false;
  private runningTasks = 0;
  private readonly abortCtrl = new AbrAbortController();

  // ダウンロードを担当するワーカースレッド
  private downloader: WorkerThreadPool<
    DownloadWorkerInitData, 
    DownloadRequest,
    DownloadQueryBase
  >;

  constructor(params : {
    maxConcurrency: number;
    maxTasksPerWorker: number;
    container: DownloadDiContainer;
  }) {
    super({
      objectMode: true,
      allowHalfOpen: true,
      read() {},
    });

    this.downloader = new WorkerThreadPool<
      DownloadWorkerInitData, 
      DownloadRequest,
      DownloadQueryBase
    >({
      // download-worker へのパス
      filename: path.join(__dirname, '..', 'workers', 'download-worker'),

      // download-worker の初期設定値
      initData: {
        containerParams: params.container.toJSON(),

        maxTasksPerWorker: params.maxTasksPerWorker,
      },

      // ダウンローダーのスレッド
      maxConcurrency: params.maxConcurrency,

      // 同時ダウンロード数
      maxTasksPerWorker: params.maxTasksPerWorker,
    });
  }

  close() {
    if (!this.abortCtrl.signal.aborted) {
      this.abortCtrl.abort();
    }
    this.downloader?.close();
  }


  private closer() {

    if (!this.receivedFinal || this.runningTasks > 0) {
      return;
    }
    // 全タスクが処理したので終了
    this.push(null);
  }

  // 前のstreamからデータが渡されてくる
  async _write(
    params: DownloadRequest,
    _: BufferEncoding,
    // callback: (error?: Error | null | undefined) => void,
    callback: TransformCallback,
  ) {
    
    this.runningTasks++;

    // 次のタスクをもらうために、callbackを呼び出す
    callback();

    // キャッシュファイルがあれば利用してダウンロードする
    params.useCache = true;
    
    // 別スレッドで処理する。5回までリトライする
    let retry = 0;
    while (retry < 5) {
      try {
        const downloadResult = await this.downloader.run(params);
        this.runningTasks--;

        if (isDownloadProcessError(downloadResult)) {
          this.push(downloadResult);
          this.closer();
          return;
        }

        this.push(downloadResult);
        this.closer();
        return;
      } catch (e) {
        console.debug("--------> retry!!!", e);
        console.debug(params);
        retry--;

        // ディレイを挿入
        await timers.setTimeout(Math.random() * 5000 + 100);

        // リトライする場合はキャッシュファイルを使わない
        params.useCache = false;
      }
    }

    this.abortCtrl.abort(new Event(`Can not download the file: ${params.packageId}`));
    this.close();
  }

  _final(callback: (error?: Error | null) => void): void {
    this.receivedFinal = true;
    callback();
  }
}
