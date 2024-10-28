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
import { WorkerThreadPool } from "@domain/services/thread/worker-thread-pool";
import { AsyncResource } from "node:async_hooks";
import path from 'node:path';
import { Readable, Writable } from "node:stream";
import { AbrGeocoderDiContainer } from "./models/abr-geocoder-di-container";
import { AbrGeocoderInput } from "./models/abrg-input-data";
import { Query, QueryJson } from "./models/query";
import { GeocodeTransform, GeocodeWorkerInitData } from "./worker/geocode-worker";

class AbrGeocoderTaskInfo extends AsyncResource {
  next: AbrGeocoderTaskInfo | undefined;
  result?: Query;
  error?: null | undefined | Error;

  private _isResolved: boolean = false;

  get isResolved(): boolean {
    return this._isResolved;
  }

  constructor(
    public readonly data: AbrGeocoderInput,
    public readonly resolve: (value: Query) => void,
    public readonly reject: (err: Error) => void,
  ) {
    super('AbrGeocoderTaskInfo');
  }

  emit(): boolean {
    if (!this.isResolved) {
      return false;
    }
    if (this.error) {
      this.runInAsyncScope(this.reject, this, this.error);
    } else {
      this.runInAsyncScope(this.resolve, this, this.result);
    }
    this.emitDestroy();
    return true;
  }

  setResult(err: null | undefined | Error, result?: Query) {
    this._isResolved = true;
    if (err) {
      this.error = err;
    } else {
      this.result = result;
    }
  }
}
export class AbrGeocoder {
  private workerPool?: WorkerThreadPool<GeocodeWorkerInitData, AbrGeocoderInput, QueryJson>;
  private readonly reader = new Readable({
    objectMode: true,
    read() {},
  });
  private isClosed = false;
  private readonly abortController = new AbortController();
  private taskHead: AbrGeocoderTaskInfo | undefined;
  private taskTail: AbrGeocoderTaskInfo | undefined;
  private readonly taskToNodeMap: Map<number, AbrGeocoderTaskInfo> = new Map();
  private flushing: boolean = false;

  private constructor(params: {
    geocodeTransformOnMainThread: GeocodeTransform,
    container: AbrGeocoderDiContainer;
    numOfThreads: number;
  }) {
    // Promiseの resolveに結果を渡す
    const dst = new Writable({
      objectMode: true,
      write: (query: Query, _, callback) => {
        callback();
        const taskId = query.input.taskId;
        if (!this.taskToNodeMap.has(taskId)) {
          throw `Can not find the taskId: ${taskId}`;
        }

        const taskNode = this.taskToNodeMap.get(taskId);
        this.taskToNodeMap.delete(taskId);
        taskNode?.setResult(null, query);
        this.flushResults();
      },
    });
    this.reader.pipe(params.geocodeTransformOnMainThread).pipe(dst);

    if (process.env.NODE_ENV === 'test:e2e') {
      return;
    }

    setImmediate(() => {
        
      WorkerThreadPool.create<GeocodeWorkerInitData, AbrGeocoderInput, QueryJson>({
        // 最大何スレッド生成するか
        maxConcurrency: Math.max(1, params.numOfThreads),

        // 1スレッドあたり、いくつのタスクを同時並行させるか
        // (増減させても大差はないので、固定値にする)
        maxTasksPerWorker: 10,

        // geocode-worker.ts へのパス
        filename: path.join(__dirname, 'worker', 'geocode-worker'),

        // geocode-worker.ts の初期化に必要なデータ
        initData: {
          containerParams: params.container.toJSON(),
          // commonData: toSharedMemory(params.commonData),
        },

        signal: this.abortController.signal,
      }).then(pool => {
        if (this.isClosed) {
          pool.close();
          return;
        }
        this.workerPool = pool;
        const tasks = Array.from(this.taskToNodeMap.values());
        tasks.forEach(taskNode => {
          this.workerPool?.run(taskNode.data)
            .then((result: QueryJson) => {
              const query = Query.from(result);
              taskNode.setResult(null, query);
            })
            .catch((error: Error) => {
              taskNode.setResult(error);
            })
            .finally(() => this.flushResults());
        });

      }).catch((reason: unknown) => {
        console.error(reason);
      });
    });
  }

  private flushResults() {
    if (this.flushing) {
      return;
    }
    this.flushing = true;
    while (this.taskHead && this.taskHead.isResolved) {
      // resolve or reject を実行する
      this.taskHead.emit();
      const nextTask = this.taskHead.next;
      this.taskHead.next = undefined;
      this.taskHead = nextTask;
    }
    if (!this.taskHead) {
      this.taskTail = undefined;
    }
    this.flushing = false;
  }

  geocode(input: AbrGeocoderInput): Promise<Query> {
    let taskId = Math.floor(performance.now() + Math.random() * performance.now());
    while (this.taskToNodeMap.has(taskId)) {
      taskId = Math.floor(performance.now() + Math.random() * performance.now());
    }

    // バックグラウンドスレッドが準備できるまでは
    // メインスレッドで処理する
    return new Promise((
      resolve: (result: Query) => void,
      reject: (err: Error) => void,
    ) => {
      const taskNode = new AbrGeocoderTaskInfo(input, resolve, reject);
      this.taskToNodeMap.set(taskId, taskNode);

      if (this.taskHead) {
        this.taskTail!.next = taskNode;
        this.taskTail = taskNode;
      } else {
        this.taskHead = taskNode;
        this.taskTail = taskNode;
      }
      
      // バックグラウンドスレッドが利用できるときは、そちらで処理する
      if (this.workerPool) {
        this.workerPool
          .run(input)
          .then((result: QueryJson) => {
            const query = Query.from(result);
            taskNode.setResult(null, query);
          })
          .catch((error: Error) => {
            taskNode.setResult(error);
          })
          .finally(() => this.flushResults());
        return;
      }
      
      // バックグラウンドが準備中なので、メインスレッドで処理する
      this.reader.push({
        data: input,
        taskId,
      });
    });
  }
  
  close() {
    this.isClosed = true;
    this.reader.push(null);
    this.abortController.abort();
    this.workerPool?.close();
  }

  static readonly create = async (params: Required<{
    container: AbrGeocoderDiContainer;
    numOfThreads: number;
  }>): Promise<AbrGeocoder> => {
    // geocode-worker の初期化中はメインスレッドで処理を行う
    const geocodeTransformOnMainThread = await GeocodeTransform.create({
      containerParams: params.container.toJSON(),
    });

    const geocoder = new AbrGeocoder({
      ...params,
      geocodeTransformOnMainThread,
    });
    return geocoder;
  };
}
