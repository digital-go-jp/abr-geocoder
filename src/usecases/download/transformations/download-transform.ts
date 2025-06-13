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
import { DownloadProcessStatus, DownloadQueryBase, DownloadRequest } from '@domain/models/download-process-query';
import { WorkerThreadPool } from '@domain/services/thread/worker-thread-pool';
import { DownloadDiContainer } from '@usecases/download/models/download-di-container';
import { DownloadWorkerInitData } from '@usecases/download/workers/download-worker';
import path from 'node:path';
import { Duplex, TransformCallback } from 'node:stream';
import timers from 'node:timers/promises';

export type DownloadTransformOptions = {
  maxConcurrency: number;
  maxTasksPerWorker: number;
  container: DownloadDiContainer;
};

export class DownloadTransform extends Duplex {

  private receivedFinal: boolean = false;
  private runningTasks = 0;
  private abortCtrl = new AbortController();

  // ダウンロードを担当するワーカースレッド
  private downloader!: WorkerThreadPool<
    DownloadWorkerInitData, 
    DownloadRequest,
    DownloadQueryBase
  >;
  
  static create = async (params: Required<DownloadTransformOptions>): Promise<DownloadTransform> => {
    const downloader = new DownloadTransform();
    await downloader.initAsync(params);
    return downloader;
  };

  private constructor() {
    super({
      objectMode: true,
      allowHalfOpen: true,
      read() {},
    });
  }
  private async initAsync(params : Required<DownloadTransformOptions>) {
    this.downloader = await WorkerThreadPool.create<
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

  // 前のstreamからデータが渡されてくる
  async _write(
    params: DownloadRequest,
    _: BufferEncoding,
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

        if (downloadResult.status === DownloadProcessStatus.ERROR) {
          this.push(downloadResult);
          if (this.runningTasks === 0 && this.receivedFinal) {
            this.push(null);
          }
          return;
        }

        this.push(downloadResult);
        if (this.runningTasks === 0 && this.receivedFinal) {
          this.push(null);
        }
        return;
      } catch (e) {
        console.debug("--------> retry!!!", e);
        console.debug(params);
        retry++;

        // ディレイを挿入
        await timers.setTimeout(Math.random() * 3000 + 1000);

        // リトライする場合はキャッシュファイルを使わない
        params.useCache = false;
      }
    }

    console.debug("aborted!!!");
    this.abortCtrl.abort(`Can not download the file: ${params.packageId}`);
    this.close();
  }

  _final(callback: (error?: Error | null) => void): void {
    this.receivedFinal = true;
    callback();
  }
}
