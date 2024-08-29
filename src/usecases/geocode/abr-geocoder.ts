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
import path from 'node:path';
import { Readable, Writable } from "node:stream";
import { AbrGeocoderDiContainer } from "./models/abr-geocoder-di-container";
import { AbrGeocoderInput } from "./models/abrg-input-data";
import { Query, QueryInput, QueryJson } from "./models/query";
import { GeocodeTransform, GeocodeWorkerInitData } from "./worker/geocode-worker";

export class AbrGeocoder {
  private workerPool?: WorkerThreadPool<GeocodeWorkerInitData, AbrGeocoderInput, QueryJson>;
  private readonly reader = new Readable({
    objectMode: true,
    read() {},
  });
  private resolvers: Map<number, (data: QueryJson) => void> = new Map();
  private _total: number = 0;
  private isClosed = false;
  private readonly abortController = new AbortController();

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
        const resolver = this.resolvers.get(taskId)!;
        this.resolvers.delete(taskId);
        resolver(query.toJSON());
      },
    });
    this.reader.pipe(params.geocodeTransformOnMainThread).pipe(dst);

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
      }).catch((reason: unknown) => {
        console.error(reason);
      });
    });
  }

  geocode(input: AbrGeocoderInput): Promise<QueryJson> {
    // バックグラウンドスレッドが利用できるときは、そちらで処理する
    if (this.workerPool) {
      return this.workerPool.run(input);
    }

    const lineId = ++this._total;

    // バックグラウンドスレッドが準備できるまでは
    // メインスレッドで処理する
    return new Promise((resolve: (result: QueryJson) => void) => {
      let taskId = Math.floor(performance.now() + Math.random() * performance.now());
      while (this.resolvers.has(taskId)) {
        taskId = Math.floor(performance.now() + Math.random() * performance.now());
      }

      this.resolvers.set(taskId, resolve);

      const queryInput: QueryInput = {
        data: input,
        taskId,
        lineId,
      };

      this.reader.push(queryInput);
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
    // const dbCtrl = params.container.database;
    // const commonDb: ICommonDbGeocode = await dbCtrl.openCommonDb();
    // const commonData = await loadGeocoderCommonData({
    //   commonDb,
    //   cacheDir: params.container.cacheDir,
    // });

    // geocode-worker の初期化中はメインスレッドで処理を行う
    const geocodeTransformOnMainThread = await GeocodeTransform.create({
      containerParams: params.container.toJSON(),
      // commonData: toSharedMemory(commonData),
    });

    const geocoder = new AbrGeocoder({
      ...params,
      geocodeTransformOnMainThread,
    });
    return geocoder;
  };
}
