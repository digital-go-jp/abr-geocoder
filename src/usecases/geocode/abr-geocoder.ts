import { WorkerThreadPool } from "@domain/services/thread/worker-thread-pool";
import path from 'node:path';
import { EventEmitter } from "node:stream";
import { GeocoderDiContainer } from "./models/geocode-di-container";
import { QueryJson } from "./models/query";
import { GeocodeWorkerInitData } from "./worker/geocode-worker";
import { AbrGeocoderInput } from "./models/abrg-input-data";



export class AbrGeocoder extends EventEmitter {
  private readonly workerPool: WorkerThreadPool<GeocodeWorkerInitData, AbrGeocoderInput, QueryJson>;

  constructor(params: {
    container: GeocoderDiContainer,
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