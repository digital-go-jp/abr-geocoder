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
import { SearchTarget } from '@domain/types/search-target';
import { Query } from '@usecases/geocode/models/query';
import { isMainThread, MessagePort, parentPort } from "node:worker_threads";
import { setFlagsFromString } from 'v8';
import { runInNewContext } from 'vm';

// 作業スレッド
if (!isMainThread && parentPort) {
    
  setFlagsFromString('--expose_gc');
  const gc = runInNewContext('gc'); // nocommit

  setInterval(() => gc(), 5000);

  (async (parentPort: MessagePort) => {

    // メインスレッドからメッセージを受け取る
    parentPort.on('message', (task: string) => {
      const received = JSON.parse(task) as ThreadJob<number> | ThreadPing;
      switch (received.kind) {
        case 'ping': {
          parentPort.postMessage(JSON.stringify({
            kind: 'pong',
          }));
          return;
        }

        case 'task': {
          const query = Query.create({
            data: {
              address: received.data.toString(),
              searchTarget: SearchTarget.ALL,
              fuzzy: undefined,
              tag: undefined,
            },
            taskId: received.taskId,
          });

          parentPort.postMessage(JSON.stringify({
            taskId: received.taskId,
            data: query.toJSON(),
            kind: 'result',
          }));

          query.release();
          return;
        }

        default:
          throw 'not implemented';
      }
    });

  })(parentPort);
}
