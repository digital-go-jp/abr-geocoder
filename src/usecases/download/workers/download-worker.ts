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
import { DownloadQueryBase, DownloadRequest } from '@domain/models/download-process-query';
import { ThreadJob, ThreadPing, ThreadPong } from '@domain/services/thread/thread-task';
import { HttpRequestAdapter } from '@interface/http-request-adapter';
import { Readable, Writable } from "stream";
import { MessagePort, isMainThread, parentPort, workerData } from "worker_threads";
import { DownloadDiContainer, DownloadDiContainerParams } from '../models/download-di-container';
import { DownloadStep1Transform } from '../steps/download-step1-transform';

export type DownloadWorkerInitData = {
  containerParams: DownloadDiContainerParams;

  maxTasksPerWorker: number;
};

export const downloadOnWorkerThread = async (params: Required<{
  port: MessagePort;
  initData: DownloadWorkerInitData;
}>) => {
  const container = new DownloadDiContainer(params.initData.containerParams);
  
  const client = new HttpRequestAdapter({
    hostname: container.env.hostname,
    userAgent: container.env.userAgent,
    peerMaxConcurrentStreams: params.initData.maxTasksPerWorker,
  });

  // CKANからダウンロードを行う
  const downloader = new DownloadStep1Transform({
    client,
    urlCacheMgr: container.urlCacheMgr,
    downloadDir: container.downloadDir,
    fileShowUrl: container.getFileShowUrl(),
    highWaterMark: params.initData.maxTasksPerWorker,
  });

  const reader = new Readable({
    objectMode: true,
    read() {},
  });

  // メインスレッドに結果を送信する
  const dst = new Writable({
    objectMode: true,
    write(job: ThreadJob<DownloadQueryBase>, _, callback) {
      params.port.postMessage(JSON.stringify({
        taskId: job.taskId,
        kind: 'result',
        data: job.data,
      }));

      callback();
    },
  });

  reader
    .pipe(downloader)
    .pipe(dst);

  // メインスレッドからメッセージを受け取る
  params.port.on('message', (msg: string) => {
    const data = JSON.parse(msg) as ThreadJob<DownloadRequest> | ThreadPing;
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
        reader.push(data as ThreadJob<DownloadRequest>);
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
  downloadOnWorkerThread({
    port: parentPort,
    initData: workerData as DownloadWorkerInitData,
  });
}
