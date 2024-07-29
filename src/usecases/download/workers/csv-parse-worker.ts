import { DownloadQuery2, DownloadQueryBase, DownloadRequest } from '@domain/models/download-process-query';
import { SemaphoreManager } from '@domain/services/thread/semaphore-manager';
import { fromSharedMemory, toSharedMemory } from '@domain/services/thread/shared-memory';
import { ThreadJob, ThreadJobResult, ThreadMessage } from '@domain/services/thread/thread-task';
import { Readable, Writable } from "stream";
import { MessagePort, isMainThread, parentPort, workerData } from "worker_threads";
import { DownloadDiContainer, DownloadDiContainerParams } from '../models/download-di-container';
import { CsvLoadStep1Transform } from '../steps/csv-load-step1-transform';
import { CsvLoadStep2Transform } from '../steps/csv-load-step2-transform';
import { DownloadStep2Transform } from '../steps/download-step2-transform';

export type ParseWorkerInitData = {
  containerParams: DownloadDiContainerParams,
  lgCodeFilter: string[];
  semaphoreSharedMemory: SharedArrayBuffer;
}

export const parseOnWorkerThread = async (params: Required<{
  port: MessagePort;
  initData: ParseWorkerInitData;
}>) => {
  const container = new DownloadDiContainer(params.initData.containerParams);

  // ZIPファイルを展開する
  const step2 = new DownloadStep2Transform({
    downloadDir: container.downloadDir,
  });

  // CSVファイルを分析してDatasetにする
  const step3 = new CsvLoadStep1Transform({
    lgCodeFilter: new Set(params.initData.lgCodeFilter),
  });

  // データベース書き込みのためのセマフォ
  const semaphore = new SemaphoreManager(params.initData.semaphoreSharedMemory);

  // データベースに書き込みを行う
  const databaseCtrl = container.database;
  const step4 = new CsvLoadStep2Transform({
    databaseCtrl,
    semaphore,
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
    .pipe(step2)
    .pipe(step3)
    .pipe(step4)
    .pipe(dst);

  // メインスレッドからタスク情報を受け取ったので
  // ダウンロード処理のストリームに投げる
  params.port.on('message', (sharedMemory: Uint8Array) => {
    const params = fromSharedMemory<ThreadMessage<any> | ThreadJob<DownloadQuery2>>(sharedMemory);
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
  parseOnWorkerThread({
    port: parentPort,
    initData: workerData as ParseWorkerInitData,
  });
}