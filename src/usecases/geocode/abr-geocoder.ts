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
import { EventEmitter } from "stream";
import { AbrGeocoderDiContainer } from "./models/abr-geocoder-di-container";
import { QueryJson } from "./models/query";
import { GeocodeWorkerInitData } from "./worker/geocode-worker";
import { AbrGeocoderInput } from "./models/abrg-input-data";

export class AbrGeocoder extends EventEmitter {
  private readonly workerPool: WorkerThreadPool<GeocodeWorkerInitData, AbrGeocoderInput, QueryJson>;

  constructor(params: {
    container: AbrGeocoderDiContainer,
    maxConcurrency: number;
  }) {
    super();

    this.workerPool = new WorkerThreadPool({
      // 最大何スレッド生成するか
      maxConcurrency: Math.max(1, params.maxConcurrency),

      // 1スレッドあたり、いくつのタスクを同時並行させるか
      // (増減させても大差はないので、固定値にする)
      maxTasksPerWorker: 3,

      // geocode-worker.ts へのパス
      filename: path.join(__dirname, 'worker', 'geocode-worker'),

      // geocode-worker.ts の初期化に必要なデータ
      initData: {
        containerParams: params.container.toJSON(),
      },
    });
  }
  // 1件だけのリクエストを処理する場合にこのメソッドを呼び出す
  async geocode(input: AbrGeocoderInput): Promise<QueryJson> {

    // 別スレッドで処理する
    const result: QueryJson = await this.workerPool.run(input);

    return result;
  }
  
  async close() {
    await this.workerPool.close();
  }
}