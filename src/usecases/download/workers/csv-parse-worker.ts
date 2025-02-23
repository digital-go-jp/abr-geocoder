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
import { DownloadProcessBase, DownloadProcessError, DownloadProcessSkip, DownloadProcessStatus, DownloadQuery2 } from '@domain/models/download-process-query';
import { ThreadJob, ThreadJobResult, ThreadPing, ThreadPong } from '@domain/services/thread/thread-task';
import { Readable, Transform, Writable } from "stream";
import { MessagePort, isMainThread, parentPort, workerData } from "worker_threads";
import { DownloadDiContainer, DownloadDiContainerParams } from '../models/download-di-container';
import { CsvLoadStep1Transform } from '../steps/csv-load-step1-transform';
import { CsvLoadStep2Transform } from '../steps/csv-load-step2-transform';
import { DownloadStep2Transform } from '../steps/download-step2-transform';
import { SemaphoreManager } from '@domain/services/thread/semaphore-manager';

export type ParseWorkerInitData = {
  containerParams: DownloadDiContainerParams,
  lgCodeFilter: string[];
  maxTasksPerWorker: number;
  semaphoreSharedMemory: SharedArrayBuffer;
};

export const parseOnWorkerThread = async (params: Required<{
  port: MessagePort;
  initData: ParseWorkerInitData;
}>) => {
  const container = new DownloadDiContainer(params.initData.containerParams);
  
  // データベース書き込みのためのセマフォ
  const semaphore = new SemaphoreManager(params.initData.semaphoreSharedMemory);

  // ZIPファイルを展開する
  const step2 = new DownloadStep2Transform({
    downloadDir: container.downloadDir,
  });

  // CSVファイルを分析してDatasetにする
  const step3 = new CsvLoadStep1Transform({
    lgCodeFilter: new Set(params.initData.lgCodeFilter),
  });

  // データベースに書き込みを行う
  const databaseCtrl = container.database;
  const step4 = new CsvLoadStep2Transform({
    databaseCtrl,
    semaphore,
    keepFiles: container.keepFiles,
  });

  const reader = new Readable({
    objectMode: true,
    read() {},
  });
  
  // メインスレッドに結果を送信する
  const returnTheResult = (job: ThreadJob<DownloadProcessBase>) => {
    const jsonStr = JSON.stringify({
      taskId: job.taskId,
      kind: 'result',
      data: job.data,
    });
    params.port.postMessage(jsonStr);
  };

  const dst = new Writable({
    objectMode: true,
    write(job: ThreadJob<DownloadProcessBase>, _, callback) {
      returnTheResult(job);
      callback();
    },
  });
  
  reader
    .pipe(new Transform({
      objectMode: true,
      allowHalfOpen: true,
      transform(job: ThreadJobResult<DownloadProcessError | DownloadQuery2 | DownloadProcessSkip>, _, callback) {

        // エラーになったQuery or 変更がないZIPファイルはスキップする
        if (
          job.data.status === DownloadProcessStatus.ERROR || 
          job.data.status === DownloadProcessStatus.SKIP
        ) {
          returnTheResult({
            ...job,
            kind: 'task',
          });
          callback();
          return;
        }

        // ダウンロードされたファイル
        callback(null, job);
      },
    }))
    .pipe(step2)
    .pipe(step3)
    .pipe(step4)
    .pipe(dst);

  // メインスレッドからメッセージを受け取る
  params.port.on('message', (msg: string) => {
    const data = JSON.parse(msg) as ThreadJob<DownloadQuery2> | ThreadPing;
    switch (data.kind) {
      case 'ping': {
        params.port.postMessage(JSON.stringify({
          kind: 'pong',
        } as ThreadPong));
        return;
      }

      case 'task': {
      // メインスレッドからタスク情報を受け取ったので
      // ダウンロード処理のストリームに投げる
        reader.push(data as ThreadJob<DownloadQuery2>);
        return;
      }

      default:
        throw 'not implemented';
    }
  });
};

// 作業スレッド
if (!isMainThread && parentPort) {
  // if (process.execArgv.includes("--inspect-brk")) {
  //   const port = (workerData as InitData).port;
  //   inspector.open(port);
  //   inspector.waitForDebugger();
  // }
  parseOnWorkerThread({
    port: parentPort,
    initData: workerData as ParseWorkerInitData,
  });
}
