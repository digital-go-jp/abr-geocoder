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
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { fromSharedMemory, toSharedMemory } from './shared-memory';
import { ThreadJob, ThreadJobResult, ThreadPing, ThreadPong } from './thread-task';
import { WorkerPoolTaskInfo } from './worker-thread-pool-task-info';

export class WorkerThread<I, T, R> extends Worker {
  private resolvers: Map<number, (data: R) => void> = new Map();
  private tasks: Map<number, WorkerPoolTaskInfo<T, R>> = new Map();
  private _total: number = 0;
  public get totalTasks(): number {
    return this._total;
  };

  private _numOfTasks: number = 0;
  public get numOfTasks(): number {
    return this._numOfTasks;
  };

  public getTasks(): WorkerPoolTaskInfo<T, R>[] {
    return Array.from(this.tasks.values());
  }

  private constructor(params: {
    filename: string | URL,
    initData?: I,
  }) {
    const name = path.basename(params.filename.toString());
    super(params.filename, {
      workerData: params.initData,
      name,
      // execArgv: ['--inspect-brk'],
      stdout: false,  // Sets false to pass the output to the parent thread.
      stderr: false,  // Sets false to pass the output to the parent thread.
    });

    this.on('message', (shareMemory: Uint8Array) => {
      const received = fromSharedMemory<ThreadJobResult<R> | ThreadPong>(shareMemory);

      if (received.kind !== 'result') {
        return;
      }

      // addTask で生成した Promise の resolve を実行する
      const taskId = received.taskId;
      const resolve = this.resolvers.get(taskId);
      if (!resolve) {
        throw new Error(`can not find resolver for ${taskId}`);
      }

      this.tasks.delete(taskId);
      this.resolvers.delete(taskId);
      this._numOfTasks--;
      resolve(received.data);
    });
  }
  private async initAsync(signal?: AbortSignal) {
    return new Promise((
      resolve: (_?: unknown) => void,
      reject: (_?: unknown) => void,
    ) => {
      const abortListener = () => {
        signal?.removeEventListener('abort', abortListener);
        reject(new Event('abort'));
      };
      signal?.addEventListener('abort', abortListener, {
        once: true,
      });

      this.once('message', (shareMemory: Uint8Array) => {
        const received = fromSharedMemory<ThreadPong>(shareMemory);
        if (received.kind !== 'pong') {
          return;
        }
        resolve();
      });
      this.postMessage(toSharedMemory<ThreadPing>({
        kind: 'ping',
      }));
    });
  }

  // スレッド側にタスクを送る
  addTask(task: WorkerPoolTaskInfo<T, R>) {
    this._total++;
    this._numOfTasks++;
    return new Promise((resolve: (data: R) => void) => {
      let taskId = Math.floor(performance.now() + Math.random()  * performance.now());
      while (this.tasks.has(taskId)) {
        taskId = Math.floor(performance.now() + Math.random()  * performance.now());
      }
      this.tasks.set(taskId, task);
  
      // console.error(JSON.stringify({
      //   taskId,
      //   kind: 'task',
      //   data: task.data,
      // }, null, 2));
      this.postMessage(toSharedMemory<ThreadJob<T>>({
        taskId,
        kind: 'task',
        data: task.data,
      }));

      this.resolvers.set(taskId, resolve);
    });
  }

  static readonly create = async <I, T, R>(params: {
    filename: string | URL;
    initData?: I;
    signal?: AbortSignal;
  }) => {
    const worker = new WorkerThread<I, T, R>(params);
    await worker.initAsync(params.signal);
    return worker;
  };
}
