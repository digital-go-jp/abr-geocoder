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
import { AbrAbortController } from '@domain/models/abr-abort-controller';
import { DownloadProcessBase, DownloadProcessStatus, DownloadQuery2 } from '@domain/models/download-process-query';
import { WorkerThreadPool } from '@domain/services/thread/worker-thread-pool';
import { DownloadDiContainer } from '@usecases/download/models/download-di-container';
import path from 'node:path';
import { Duplex, TransformCallback } from 'node:stream';
import { ParseWorkerInitData } from '../workers/csv-parse-worker';

export class CsvParseTransform extends Duplex {

  private receivedFinal: boolean = false;
  private runningTasks = 0;
  private readonly abortCtrl = new AbrAbortController();

  // ダウンロードされた zip ファイルを展開して、データベースに登録するワーカースレッド
  private csvParsers: WorkerThreadPool<
    Required<ParseWorkerInitData>,
    DownloadQuery2,
    DownloadProcessBase
  >;

  constructor(params : {
    maxConcurrency: number;
    semaphoreSize: number;
    container: DownloadDiContainer;
    lgCodeFilter: Set<string>;
  }) {
    super({
      objectMode: true,
      allowHalfOpen: true,
      read() {},
    });

    // スレッドごとに割り当てるタスクの数
    // (=同時並行でダウンロードするファイルの数)
    const maxTasksPerWorker = 5;

    // 4  = Int32Array を使用するため (32 bits = 4 bytes)
    // 最初の4は、common.sqlite を制御するために用いる。
    const semaphoreSharedMemory = new SharedArrayBuffer(4 + Math.max(params.semaphoreSize - 1, 1) * 4);

    this.csvParsers = new WorkerThreadPool<
      Required<ParseWorkerInitData>,
      DownloadQuery2,
      DownloadProcessBase
    >({
      // csv-parse-worker へのパス
      filename: path.join(__dirname, '..', 'workers', 'csv-parse-worker'),

      // スレッドを最大でいくつまで生成するか
      maxConcurrency: params.maxConcurrency,

      maxTasksPerWorker,

      // スレッド側に渡すデータ
      // プリミティブな値しか渡せない（インスタンスは渡せない）
      initData: {
        containerParams: params.container.toJSON(),
        lgCodeFilter: Array.from(params.lgCodeFilter),
        semaphoreSharedMemory,
        maxTasksPerWorker,
      },

      signal: this.abortCtrl.signal,
    });
  }

  close() {
    if (!this.abortCtrl.signal.aborted) {
      this.abortCtrl.abort();
    }
    this.csvParsers?.close();
  }

  private closer() {
    if (!this.receivedFinal || this.runningTasks > 0 || this.closed) {
      return;
    }
    // 全タスクが処理したので終了
    this.push(null);
  }

  // 前のstreamからデータが渡されてくる
  async _write(
    downloadResult: DownloadQuery2,
    _: BufferEncoding,
    // callback: (error?: Error | null | undefined) => void,
    callback: TransformCallback,
  ) {

    // 次のタスクをもらうために、先にCallbackを呼ぶ
    callback();

    // リソースファイル(zipファイル)に変更がないので、スキップする
    if (downloadResult.status === DownloadProcessStatus.SKIP) {
      this.push({
        dataset: downloadResult.dataset,
        csvFiles: [],
        urlCache: undefined,
        status: DownloadProcessStatus.SKIP,
      } as DownloadProcessBase);

      // 全てタスクが完了したかをチェック
      this.closer();
      return;
    }

    this.runningTasks++;

    try {
      // CSVファイルを分析して、データベースに登録する
      const parseResult = await this.csvParsers.run(downloadResult);
      this.push(parseResult);

      this.runningTasks--;
      // 全てタスクが完了したかをチェック
      this.closer();
    } catch (e: unknown) {

      console.error(e);
      this.abortCtrl.abort(new Event(`Can not parse the file: ${[downloadResult.csvFilePath]}`));
      
      this.close();
    };
  }

  _final(callback: (error?: Error | null) => void): void {
    this.receivedFinal = true;
    callback();
  }
}
