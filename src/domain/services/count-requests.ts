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
import { ThreadJob, ThreadPing } from '@domain/services/thread/thread-task';
import fs from 'node:fs';
import { Writable } from 'node:stream';
import { isMainThread, MessagePort, parentPort } from "node:worker_threads";
import { WorkerThreadPool } from './thread/worker-thread-pool';
import { CommentFilterTransform } from './transformations/comment-filter-transform';
import { LineByLineTransform } from './transformations/line-by-line-transform';

const internalCounter = async (filePath: string) => {

  const lineByLine = new LineByLineTransform();
  const commentFilter = new CommentFilterTransform();
  return new Promise((
    resolve: (total: number) => void,
  ) => {
    fs.createReadStream(filePath)
      .pipe(lineByLine)
      .pipe(commentFilter)
      .pipe(new Writable({
        objectMode: true,
        write(_chunk, _encoding, callback) {
          callback();
        },
        final(callback) {
          callback();
          resolve(commentFilter.total);
        },
      }));
  });
};

export const countRequests = async (filePath: string) => {

  // jest で動かしている場合は、メインスレッドで処理する
  if (process.env.JEST_WORKER_ID) {
    return await internalCounter(filePath);
  }

  // ファイルが大きい時もあるので、バッググラウンドで処理する
  const pool = await WorkerThreadPool.create<undefined, string, number>({
    filename: __filename,
    initData: undefined,
    maxConcurrency: 1,
    maxTasksPerWorker: 1,
  });
  const total = await pool.run(filePath);
  await pool.close();
  return total;
};

if (!isMainThread && parentPort) {
  (async (parentPort: MessagePort) => {

    // メインスレッドからメッセージを受け取る
    parentPort.on('message', async (task: string) => {
      const received = JSON.parse(task) as ThreadJob<string> | ThreadPing;
      (task as unknown) = null;
      switch (received.kind) {
        case 'ping': {
          parentPort.postMessage(JSON.stringify({
            kind: 'pong',
          }));
          return;
        }

        case 'task': {
          const total = await internalCounter(received.data);

          // メインスレッドに返す
          parentPort.postMessage(JSON.stringify({
            taskId: received.taskId,
            data: total,
            kind: 'result',
          }));
          return;
        }

        default:
          throw 'not implemented';
      }
    });


  })(parentPort);
}
