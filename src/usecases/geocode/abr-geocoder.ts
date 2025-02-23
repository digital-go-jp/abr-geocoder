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
import { IWorkerThreadPool } from "@domain/services/thread/iworker-thread-pool";
import { toSharedMemory } from "@domain/services/thread/shared-memory";
import { WorkerThreadPool } from "@domain/services/thread/worker-thread-pool";
import { WorkerPoolTaskInfo } from "@domain/services/thread/worker-thread-pool-task-info";
import { GeocodeTransform } from '@usecases/geocode/worker/geocode-worker';
import path from 'node:path';
import { FakeWorkerThreadPool } from "./fake-worker-thread-pool";
import { AbrGeocoderDiContainer } from "./models/abr-geocoder-di-container";
import { AbrGeocoderInput } from "./models/abrg-input-data";
import { CityAndWardTrieFinder } from "./models/city-and-ward-trie-finder";
import { CountyAndCityTrieFinder } from "./models/county-and-city-trie-finder";
import { KyotoStreetTrieFinder } from "./models/kyoto-street-trie-finder";
import { OazaChoTrieFinder } from "./models/oaza-cho-trie-finder";
import { PrefTrieFinder } from "./models/pref-trie-finder";
import { Query, QueryJson } from "./models/query";
import { Tokyo23TownTrieFinder } from "./models/tokyo23-town-finder";
import { Tokyo23WardTrieFinder } from "./models/tokyo23-ward-trie-finder";
import { WardTrieFinder } from "./models/ward-trie-finder";
import { GeocodeWorkerInitData } from "./worker/geocode-worker-init-data";
import { AbrAbortSignal } from "@domain/models/abr-abort-controller";
import { PrefLgCode } from "@domain/types/pref-lg-code";
import { PrefInfo } from "@domain/types/geocode/pref-info";

export class AbrGeocoder {
  private taskHead: WorkerPoolTaskInfo<AbrGeocoderInput, Query> | undefined;
  private taskTail: WorkerPoolTaskInfo<AbrGeocoderInput, Query> | undefined;
  private readonly taskIDs: Set<number> = new Set();
  private flushing: boolean = false;

  private constructor(
    private readonly workerPool: IWorkerThreadPool<AbrGeocoderInput, QueryJson>,
    private readonly signal?: AbrAbortSignal,
  ) {
    this.signal?.addEventListener('abort', () => this.close());
  }

  private flushResults() {
    // 処理が完了しているタスクを、入力順に出力する
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
    while (this.taskIDs.has(taskId)) {
      taskId = Math.floor(performance.now() + Math.random() * performance.now());
    }
    // resolver, rejector をキープする
    const taskNode = new WorkerPoolTaskInfo<AbrGeocoderInput, Query>(input);
    this.taskIDs.add(taskId);

    // 順番を維持するために、連結リストで追加する
    if (this.taskHead) {
      this.taskTail!.next = taskNode;
      this.taskTail = taskNode;
    } else {
      this.taskHead = taskNode;
      this.taskTail = taskNode;
    }

    return new Promise<Query>((
      resolve: (result: Query) => void,
      reject: (error: Error) => void,
    ) => {
      taskNode.setResolver(resolve);
      taskNode.setRejector(reject);

      this.workerPool.run(input)
        .then((result: QueryJson) => {
          const query = Query.from(result);
          taskNode.setResult(null, query);
        })
        .catch((error: Error) => {
          taskNode.setResult(error);
        })
        .finally(() => {
          this.taskIDs.delete(taskId);
          this.flushResults();
        });
    });
  }
  
  async close() {
    await this.workerPool.close();
  }

  static create = async (params: {
    container: AbrGeocoderDiContainer;
    numOfThreads: number;
    signal?: AbrAbortSignal;
    isSilentMode: boolean;
  }) => {
    const db = await params.container.database.openCommonDb();
    const prefList: PrefInfo[] = await db.getPrefList();

    // トライ木を作成するために必要な辞書データの読み込み
    const pref = toSharedMemory((await PrefTrieFinder.loadDataFile({
      diContainer: params.container,
      data: {
        type: "pref",
      },
    }))!);
    const countyAndCity = toSharedMemory((await CountyAndCityTrieFinder.loadDataFile({
      diContainer: params.container,
      data: {
        type: "county-and-city",
      },
    }))!);
    const cityAndWard = toSharedMemory((await CityAndWardTrieFinder.loadDataFile({
      diContainer: params.container,
      data:  {
        type: "city-and-ward",
      },
    }))!);
    const kyotoStreet = toSharedMemory((await KyotoStreetTrieFinder.loadDataFile({
      diContainer: params.container,
      data:  {
        type: "kyoto-street",
      },
    }))!);

    const oazaChomes = [];
    for await (const prefInfo of prefList) {
      oazaChomes.push({
        lg_code: prefInfo.lg_code as PrefLgCode,
        data: toSharedMemory((await OazaChoTrieFinder.loadDataFile({
          diContainer: params.container,
          data:  {
            type: "oaza-cho",
            lg_code: prefInfo.lg_code as PrefLgCode,
          },
        }))!),
      });
    }

    const ward = toSharedMemory((await WardTrieFinder.loadDataFile({
      diContainer: params.container,
      data: {
        type:  "ward",
      },
    }))!);
    const tokyo23Ward = toSharedMemory((await Tokyo23WardTrieFinder.loadDataFile({
      diContainer: params.container,
      data:  {
        type: "tokyo23-ward",
      },
    }))!);
    const tokyo23Town = toSharedMemory((await Tokyo23TownTrieFinder.loadDataFile({
      diContainer: params.container,
      data:  {
        type: "tokyo23-town",
      },
    }))!);

    const initData: GeocodeWorkerInitData = {
      diContainer: params.container.toJSON(),
      trieData: {
        pref,
        countyAndCity,
        cityAndWard,
        kyotoStreet,
        oazaChomes,
        ward,
        tokyo23Ward,
        tokyo23Town,
      },
      debug: false,
    };

    // スレッド数が2未満、もしくは、jest で動かしている場合は、メインスレッドで処理する
    if (params.numOfThreads < 2 || process.env.JEST_WORKER_ID !== undefined) {
      const geocodeTransform = await GeocodeTransform.create(initData);
      const fakePool = new FakeWorkerThreadPool(geocodeTransform);

      return new AbrGeocoder(
        fakePool,
        params.signal,
      );
    }

    const workerPool = await WorkerThreadPool.create<GeocodeWorkerInitData, AbrGeocoderInput, QueryJson>({
      // 最大何スレッド生成するか
      maxConcurrency: Math.max(1, params.numOfThreads),

      // 1スレッドあたり、いくつのタスクを同時並行させるか
      // (ストリームのバックプレッシャに影響するので、固定値にしておく)
      maxTasksPerWorker: 500,

      // geocode-worker.ts へのパス
      filename: path.join(__dirname, 'worker', 'geocode-worker'),

      // geocode-worker.ts の初期化に必要なデータ
      initData,

      signal: params.signal,
    });
    
    return new AbrGeocoder(
      workerPool,
      params.signal,
    );
  };

}
