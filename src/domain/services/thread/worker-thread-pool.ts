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
import { EventEmitter } from 'node:events';
import { DebugLogger } from '../logger/debug-logger';
import { WorkerThread } from './worker-thread';
import { WorkerPoolTaskInfo } from './worker-thread-pool-task-info';
import { IWorkerThreadPool } from './iworker-thread-pool';
import { AbrAbortController } from '@domain/models/abr-abort-controller';

export type WorkerThreadPoolOptions<InitData> = {
  filename: string;
  initData?: InitData;
  // 最大いくつまでのワーカーを生成するか
  maxConcurrency: number;
  // 1つの worker にいくつのタスクを同時に実行させるか
  maxTasksPerWorker: number;

  signal?: AbortSignal;
};

export class WorkerThreadPool<InitData, TransformData, ReceiveData> 
  extends EventEmitter
  implements IWorkerThreadPool<TransformData, ReceiveData>
{
  private readonly kWorkerFreedEvent = Symbol('kWorkerFreedEvent');
  private readonly workers: WorkerThread<InitData, TransformData, ReceiveData>[] = [];
  private readonly signal: AbortSignal;
  private readonly waitingTasks: WorkerPoolTaskInfo<TransformData, ReceiveData>[] = [];
  private readonly abortCtrl = new AbrAbortController();

  public get waitingTaskCnt(): number {
    return this.waitingTasks.length;
  }

  private constructor(private readonly params : WorkerThreadPoolOptions<InitData>) {
    super();
    this.setMaxListeners(0);
    this.signal = this.abortCtrl.signal;
    this.params.signal?.addEventListener('abort', () => {
      if (this.abortCtrl.signal.aborted) {
        return;
      }
      this.abortCtrl.abort();
    }, {
      once: true,
    });

    // タスクが挿入 or 1つタスクが完了したら、次のタスクを実行する
    this.on(this.kWorkerFreedEvent, () => {
      if (this.signal.aborted) {
        return;
      }
      if (this.waitingTasks.length === 0 || this.workers.length === 0) {
        return;
      }
      const task = this.waitingTasks.shift()!;
      const worker = this.workers.shift()!;

      worker.addTask(task)
        .then((data: ReceiveData) => {
          // run() で生成した Promise の resolve を実行する
          task.done(null, data);
        })
        .finally(() => {
          // キューをシフトさせる
          this.emit(this.kWorkerFreedEvent);
        });
      
      this.workers.push(worker);
    });
  }

  private async initAsync() {
    const tasks = [];
    // Creates threads
    for (let i = 0; i < this.params.maxConcurrency; i++) {
      if (this.signal.aborted) {
        break;
      }
      tasks.push(this.createWorker(this.params));
    }
    const workers = await Promise.all(tasks);

    // Terminates created workers
    if (this.signal.aborted) {
      workers.forEach(worker => worker && worker.terminate());
      return;
    }

    // Processes the tasks
    workers.forEach(worker => worker && this.workers.push(worker));
    this.emit(this.kWorkerFreedEvent);
  }

  static readonly create = async <InitData, TransformData, ReceiveData> (params: WorkerThreadPoolOptions<InitData>): Promise<WorkerThreadPool<InitData, TransformData, ReceiveData>> =>  {
    const pool = new WorkerThreadPool<InitData, TransformData, ReceiveData>(params);
    await pool.initAsync();
    return pool;
  };

  private async createWorker(params: {
    filename: string;
    initData?: InitData;
  }): Promise<WorkerThread<InitData, TransformData, ReceiveData> | undefined> {
    if (this.signal.aborted) {
      return;
    }

    const worker = await WorkerThread.create<InitData, TransformData, ReceiveData>({
      signal: this.signal,
      filename: params.filename,
      initData: params.initData,
    });
    if (this.signal.aborted) {
      return;
    }
    worker.on('error', async (error: Event | string) => {
      if (typeof error === 'string' && error === 'abort' || error instanceof Event && error.type === 'abort') {
        return;
      }
      console.error(error);
      worker.removeAllListeners();
      const logger = DebugLogger.getInstance();
      logger.error(`thread error`, error);

      // エラーが発生したら、rejectを呼び出す
      // (どうするかは呼び出し元で考える)
      const failedTasks = worker.getTasks();
      failedTasks.forEach(task => {
        if (error instanceof Error) {
          task.done(error);
        }
      });
      if (this.signal.aborted) {
        return;
      }

      // 終了したスレッドは新しいスレッドに置換する
      const newWorker = await this.createWorker({
        filename: params.filename,
        initData: params.initData,
      });
      if (!newWorker) {
        return;
      }
      const idx = this.workers.indexOf(worker);
      if (idx > -1) {
        this.workers[idx] = newWorker;
      }
      worker.terminate();
    });

    return worker;
  }
  
  async run(workerData: TransformData): Promise<ReceiveData> {
    if (this.signal.aborted) {
      return Promise.reject(new Event('abort'));
    }

    return await new Promise((
      resolve: (value: ReceiveData) => void,
      reject: (err: Error) => void,
    ) => {
      const taskNode = new WorkerPoolTaskInfo<TransformData, ReceiveData>(workerData);
      taskNode.setResolver(resolve);
      taskNode.setRejector(reject);
    
      // タスクキューに入れる
      this.waitingTasks.push(taskNode);
      
      // タスクキューから次のタスクを取り出して実行する
      this.emit(this.kWorkerFreedEvent);
    });
  }

  async close() {
    if (this.signal.aborted) {
      return;
    }
    this.abortCtrl.abort();
  }
}
