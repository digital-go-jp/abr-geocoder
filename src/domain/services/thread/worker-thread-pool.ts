import { AsyncResource } from 'node:async_hooks';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { Heapq } from 'ts-heapq';
import { fromSharedMemory, toSharedMemory } from './shared-memory';
import { ThreadJob, ThreadJobResult, ThreadMessage } from './thread-task';

export class WorkerPoolTaskInfo<T, R> extends AsyncResource {

  constructor(
    public readonly data: T,
    public readonly resolve: (value: R) => void,
    public readonly reject: (err: Error) => void,
  ) {
    super('WorkerPoolTaskInfo');
  }

  done(err: null | undefined | Error, result?: R) {
    if (err) {
      this.runInAsyncScope(this.reject, this, err);
    } else {
      this.runInAsyncScope(this.resolve, this, result);
    }
    this.emitDestroy();
  }
}

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

  constructor(params: {
    filename: string | URL,
    initData?: I,
  }) {
    const name = path.basename(params.filename.toString());
    super(params.filename, {
      workerData: params.initData,
      name,
      // execArgv: ['--inspect-brk'],
      stdout: false,
      stderr: false,
    });

    this.on('message', (shareMemory: Uint8Array) => {
      const received = fromSharedMemory<ThreadJobResult<R> | ThreadMessage<any>>(shareMemory);

      if (received.kind !== 'result') {
        this.emit('custom_message', received as ThreadMessage<any>);
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
  
      this.postMessage(toSharedMemory<ThreadJob<T>>({
        taskId,
        kind: 'task',
        data: task.data,
      }));

      this.resolvers.set(taskId, resolve);
    });
  }

}

export class WorkerThreadPool<InitData, TransformData, ReceiveData> extends EventEmitter {
  private readonly kWorkerFreedEvent = Symbol('kWorkerFreedEvent');
  private workers: WorkerThread<InitData, TransformData, ReceiveData>[] = [];
  private heap: WorkerThread<InitData, TransformData, ReceiveData>[] = [];
  private workerQueue: Heapq<WorkerThread<InitData, TransformData, ReceiveData>>;
  private noMoreTasks: Set<WorkerThread<InitData, TransformData, ReceiveData>> = new Set();
  private isClosed: boolean = false;
  private timer: NodeJS.Timeout | undefined;

  private waitingTasks: WorkerPoolTaskInfo<TransformData, ReceiveData>[] = [];

  constructor(params : {
    filename: string;
    initData?: InitData;
    // 最大いくつまでのワーカーを生成するか
    maxConcurrency: number;
    // 1つの worker にいくつのタスクを同時に実行させるか
    maxTasksPerWorker: number;
  }) {
    super();

    // 使用するワーカーを選ぶHeapQueue
    this.workerQueue = new Heapq<WorkerThread<InitData, TransformData, ReceiveData>>(this.heap, (a, b) => {
      // タスクが少ない方を選ぶ
      return a.totalTasks > b.totalTasks;
    })

    // 最初のワーカー
    this.addWorker({
      filename: params.filename,
      initData: params.initData,
    });
    // if (params.filename.includes('csv')) {

      // this.timer = setInterval(() => {
      //   const fname = path.basename(params.filename);
      //   // console.log(`${fname} : task: ${this.waitingTasks.length}, noMore: ${this.noMoreTasks.size}, que: ${this.workerQueue.length()}`);
        
      //   const buffer: string[] = [];
      //   this.workers.forEach((worker, idx) => {
      //     buffer.push(`#${idx}: ${worker.numOfTasks}`)
      //   });
      //   console.log(` ${fname} (${this.waitingTasks.length})  ${buffer.join(", ")}`)
      // }, 1000);

    // }
    
    const filename = path.basename(params.filename);
    // this.timer = setInterval(() => {
    //   console.log(filename, `: `, this.workers.map(worker => worker.totalTasks).join(', '));
    // }, 1000);

    // タスクが挿入 or 1つタスクが完了したら、次のタスクを実行する
    this.on(this.kWorkerFreedEvent, () => {

      // 仕事がまだ残っていて、生成したワーカーの数が maxConcurrency 未満の場合、
      // 新しくワーカーを追加する
      if (this.waitingTasks.length >= params.maxTasksPerWorker &&
        (this.noMoreTasks.size + this.heap.length < params.maxConcurrency)) {
        this.addWorker({
          filename: params.filename,
          initData: params.initData,
        });
      }

      const halfOfMaxTasksPerWorker = Math.max(params.maxTasksPerWorker >> 1, 1);

      // 各スレッドのタスク量に応じて、タスクを割り振る
      while (this.waitingTasks.length > 0 && this.heap.length > 0) {
        while ((this.heap.length > 0) && (this.workerQueue.top().numOfTasks === params.maxTasksPerWorker)) {
          
          if (this.heap.length === 1) {
            const worker = this.heap[0];
            this.noMoreTasks.add(worker);
            this.heap.length = 0;
            break;
          }
          // 1つのワーカーがこれ以上タスクを受け付けられなければ、
          // noMoreTasks に移動させる
          const worker = this.workerQueue.pop();
          this.noMoreTasks.add(worker);
        }
        
        if (this.heap.length === 0) {
          if (this.noMoreTasks.size + this.heap.length >= params.maxConcurrency) {
            break;
          }
          // ワーカーが不足しているので、追加する
          this.addWorker({
            filename: params.filename,
            initData: params.initData,
          });
        }
        const nextWorker = this.heap[0];
        // if (params.filename.includes('csv')) {
          // const buffer: string[] = [];
          // this.workers.forEach((worker, idx) => {
          //   buffer.push(`[${idx}: ${worker.numOfTasks}]`)
          // });
          // console.log(`   ${path.basename(params.filename)}(rest: ${this.waitingTasks.length})${buffer.join(", ")}`)
        // }

        // キューの先頭のタスクを取り出す
        const task = this.waitingTasks.shift();
        if (task === undefined) {
          break;
        }

        // まだ余裕があるので、タスクを投げる
        nextWorker.addTask(task).then((data: ReceiveData) => {
          // hardestWorker に入っている場合には
          // 担当しているタスクが半分になったら
          // workerQueueに戻す
          if (this.noMoreTasks.has(nextWorker) &&
          nextWorker.numOfTasks <= halfOfMaxTasksPerWorker) {

            this.noMoreTasks.delete(nextWorker);
            this.workerQueue.push(nextWorker)
          }

          // run() で生成した Promise の resolve を実行する
          task.done(null, data);
        })
        .finally(() => {
          // キューをシフトさせる
          this.emit(this.kWorkerFreedEvent);
        })

        // 1つのワーカーがこれ以上タスクを受け付けられなければ、
        // noMoreTasks に移動させる
        if (nextWorker.numOfTasks === params.maxTasksPerWorker) {
          this.workerQueue.pop();
          this.noMoreTasks.add(nextWorker);
        }
      }
    });
  }

  private crateWorker(params: {
    filename: string, 
    initData?: InitData,
  }) {
    const worker = new WorkerThread<InitData, TransformData, ReceiveData>(params);

    worker.on('error', (error: Error) => {
      worker.removeAllListeners();
      console.error(error);

      // エラーが発生したら、rejectを呼び出す
      // (どうするかは呼び出し元で考える)
      const failedTasks = worker.getTasks();
      failedTasks.forEach(task => {
        if (error instanceof Error) {
          task.done(error);
        }
      });

      // 終了したスレッドは新しいスレッドに置換する
      const newWorker = this.crateWorker({
        filename: params.filename,
        initData: params.initData,
      });

      if (this.noMoreTasks.has(worker)) {
        this.noMoreTasks.delete(worker);
      }
      const idx = this.workers.indexOf(worker);
      const heapIdx = this.heap.indexOf(worker);
      if (idx > -1) {
        this.workers[idx] = newWorker;
      }
      if (heapIdx > -1) {
        this.heap[heapIdx] = newWorker;
      }
      
      worker.terminate();

      // 次のタスクを実行する
      this.emit(this.kWorkerFreedEvent);
    });
    return worker;
  }

  private addWorker(params: {
    filename: string, 
    initData?: InitData,
  }) {
    const worker = this.crateWorker(params);
    worker.on('custom_message', data => {
      this.emit('custom_message', data);
    })
    this.workers.push(worker);
    this.workerQueue.push(worker);

    // エラーのときに再作成する場合、キューにタスクが溜まっているかもしれないので
    // 次のタスクを実行する
    this.emit(this.kWorkerFreedEvent);
  }

  // 全スレッドに対してメッセージを送信する
  broadcastMessage<M>(data: M) {
    if (this.isClosed) {
      return Promise.reject('Called broadcastMessage() after closed.');
    }
    const sharedMemory = toSharedMemory<ThreadMessage<M>>({
      kind: 'message',
      data,
    });

    for (const worker of this.noMoreTasks.values()) {
      worker.postMessage(sharedMemory);
    }
    this.heap.forEach(worker => {
      worker.postMessage(sharedMemory);
    });
  }

  async run(workerData: TransformData): Promise<ReceiveData> {
    if (this.isClosed) {
      return Promise.reject('Called run() after closed.');
    }

    return await new Promise((
      resolve: (value: ReceiveData) => void,
      reject: (err: Error) => void,
    ) => {
      // タスクキューに入れる
      this.waitingTasks.push(new WorkerPoolTaskInfo(
        workerData,
        resolve,
        reject,
      ));
      
      // タスクキューから次のタスクを取り出して実行する
      this.emit(this.kWorkerFreedEvent);
    });
  }

  async close() {
    if (this.isClosed) {
      return Promise.reject('Called close() after closed.');
    }
    // await this.broadcastMessage<{
    //   kind: 'signal';
    //   data: 'before-close'
    // }>({
    //   kind: 'signal',
    //   data: 'before-close',
    // });

    this.isClosed = true;

    // await timersPromises.setTimeout(1000);
    
    // for (const worker of this.noMoreTasks.values()) {
    //   worker.terminate();
    // }
    // this.heap.forEach(worker => {
    //   worker.terminate();
    // });
    this.workers.forEach(worker => {
      // console.log('-->terminate');
      worker.terminate();
    });
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}