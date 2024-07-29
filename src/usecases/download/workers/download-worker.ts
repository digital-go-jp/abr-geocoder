import { DownloadQueryBase, DownloadRequest } from '@domain/models/download-process-query';
import { fromSharedMemory, toSharedMemory } from '@domain/services/thread/shared-memory';
import { ThreadJob, ThreadJobResult, ThreadMessage } from '@domain/services/thread/thread-task';
import { HttpRequestAdapter } from '@interface/http-request-adapter';
import { Readable, Writable } from "stream";
import { MessagePort, isMainThread, parentPort, workerData } from "worker_threads";
import { DownloadDiContainer, DownloadDiContainerParams } from '../models/download-di-container';
import { DownloadStep1Transform } from '../steps/download-step1-transform';

export type DownloadWorkerInitData = {
  containerParams: DownloadDiContainerParams;

  maxTasksPerWorker: number;
}

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
      const sharedMemory = toSharedMemory<ThreadJobResult<DownloadQueryBase>>({
        taskId: job.taskId,
        kind: 'result',
        data: job.data,
      });
      params.port.postMessage(sharedMemory);

      callback();
    },
  });

  reader
    .pipe(downloader)
    .pipe(dst);

  // メインスレッドからタスク情報を受け取ったので
  // ダウンロード処理のストリームに投げる
  params.port.on('message', (sharedMemory: Uint8Array) => {
    const params = fromSharedMemory<ThreadJob<DownloadRequest>>(sharedMemory);
    reader.push(params as ThreadJob<DownloadRequest>);
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