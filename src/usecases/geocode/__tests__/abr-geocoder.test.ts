import { WorkerThreadPool } from "@domain/services/thread/worker-thread-pool";
import { Sqlite3Params } from "@domain/types/database-params";
import { SearchTarget } from "@domain/types/search-target";
import { beforeAll, describe, expect, jest, test } from "@jest/globals";
import { Transform } from "node:stream";
import { AbrGeocoder } from "../abr-geocoder";
import { AbrGeocoderDiContainer, AbrGeocoderDiContainerParams } from "../models/abr-geocoder-di-container";
import { AbrGeocoderInput } from "../models/abrg-input-data";
import { QueryInput, QueryJson } from "../models/query";
import { GeocodeTransform, GeocodeWorkerInitData } from "../worker/geocode-worker";
import { setImmediateSpy } from '@mock/global';

// AbrGeocoderDiContainerのモック化
// 
// ■説明
// AbrGeocoderのインスタンスを作成するためには、
// AbrGeocoderDiContainerのインスタンスが必要。
//
// AbrGeocoderDiContainerをそのまま使うことも可能だが、
// それでは結合テストになってしまう。
// モック化された AbrGeocoderDiContainer を使いたい。
//
// なのでjest.mock で AbrGeocoderDiContainer クラスをモック化する。
jest.mock("../models/abr-geocoder-di-container", () => {
  const database: Sqlite3Params = {
    type: 'sqlite3',
    dataDir: '~/.abr-geocoder/database_test',
    schemaDir: '../schema',
  };

  return {
    AbrGeocoderDiContainer: jest.fn(() => {
      return {
        // seachTargetのデフォルト値
        searchTarget: SearchTarget.ALL,

        // モック化されたデータベース
        database: {
          connectParams: database,
        },

        // 使用しているので、モックの値を返す
        toJSON: () => {
          return {
            database,
            debug: false,
          };
        },

        logger: undefined,
      };
    }),
  };
});

// AbrGeocoder内部で WorkerThreadPoolのインスタンスを作成している
// WorkerThreadPoolのダミーインスタンスを返すようにする
const workThreadPool_runMock = jest.fn(WorkerThreadPool.prototype.run).mockImplementation((_: AbrGeocoderInput) => {
  return Promise.resolve({
    dummy: 'dummy',
  });
});

const container = new AbrGeocoderDiContainer({} as AbrGeocoderDiContainerParams);

// GeocodeTransformクラスのモック化
const createGeocodeTransformSpy = () => {
  const geocodeTransformSpy = jest.fn(Transform.prototype._transform)
    .mockImplementation((chunk, _, callback) => {
      callback(null, {
        input: chunk,
        toJSON: () => {
          return {
            dummy: 'dummy',
          };
        },
      });
    });
  const geocodeTransformMock = new Transform({
    objectMode: true,
    transform: geocodeTransformSpy,
  });

  jest.spyOn(GeocodeTransform, 'create')
    .mockResolvedValue(geocodeTransformMock as unknown as GeocodeTransform);
  
  return geocodeTransformSpy;
};

const createWorkerThreadPoolSpy = (returnValue: unknown) => {
  return jest.spyOn(WorkerThreadPool, 'create')
    .mockResolvedValue(returnValue as WorkerThreadPool<GeocodeWorkerInitData, unknown, unknown>);
};

describe('AbrGeocoder', () => {
  beforeAll(() => {
    setImmediateSpy.mockClear();
  });

  test('should create an instance correctly', async () => {

    const workThreadPool_createMock = createWorkerThreadPoolSpy({
      run: workThreadPool_runMock,
      close: () => {},
    });

    createGeocodeTransformSpy();
    
    // AbrGeocoderクラスの作成
    const instance = await AbrGeocoder.create({
      container,
      numOfThreads: 1,
    });

    // インスタンスが生成されていることを確認
    expect(instance).not.toBeUndefined();

    // Database.create() が呼び出されたことを確認
    expect(workThreadPool_createMock).toHaveBeenCalled();
   
    // WorkerThread.create()に対して、適切なパラメータが渡されたかを確認する
    // maxTasksPerWorkerは、実験的に変更することもあるし
    // filename は固定なので、全ての引数をチェックする必要はない。
    // 外部からの指定値で変換するポイントだけを確認する
    const params = workThreadPool_createMock.mock.calls[0][0];
    expect(params.maxConcurrency).toBe(1);
    expect((params.initData as  unknown as GeocodeWorkerInitData).containerParams).toEqual({
      database: {
        type: 'sqlite3',
        dataDir: '~/.abr-geocoder/database_test',
        schemaDir: '../schema',
      },
      debug: false,
    });
  });

  test('should involve the workerPool.run() method', async () => {

    const dummyResult = {
      dummy: 'dummy',
    } as unknown as QueryJson;
    
    createWorkerThreadPoolSpy({
      run: workThreadPool_runMock,
      close: () => {},
    });

    createGeocodeTransformSpy();

    // AbrGeocoderクラスの作成
    const abrGeocoder = await AbrGeocoder.create({
      container,
      numOfThreads: 2,
    });

    // ジオコーディングを行う
    const result = await abrGeocoder.geocode({
      address: 'test2',
      searchTarget: SearchTarget.ALL,
      fuzzy: '?',
      tag: 'something',
    });

    // workerThreadPool の run() が実行されたことを確認
    expect(workThreadPool_runMock).toHaveBeenCalledWith({
      address: 'test2',
      searchTarget: SearchTarget.ALL,
      fuzzy: '?',
      tag: 'something',
    });

    // 入力値と同じ値が返ってくることを期待
    expect(result).toMatchObject(dummyResult);

  });

  test('should involve the geocodeTransformOnMainThread.pipe() method', async () => {
    const dummyResult = {
      dummy: 'dummy',
    } as unknown as QueryJson;

    // WorkerThreadPool が作成できていない状態
    createWorkerThreadPoolSpy(undefined);
      
    const geocodeTransformSpy = createGeocodeTransformSpy();

    // AbrGeocoderクラスの作成
    const abrGeocoder = await AbrGeocoder.create({
      container,
      numOfThreads: 3,
    });

    // ジオコーディングを行う
    const result = await abrGeocoder.geocode({
      address: 'test3',
      searchTarget: SearchTarget.ALL,
      fuzzy: '?',
      tag: 'something',
    });

    // workerThreadPool の run() が実行されたことを確認
    expect(geocodeTransformSpy).toBeCalled();
    
    // taskIdはランダムなので、toBeCalledWith() は使えない
    // なので、inputだけを検証する
    const chunk = geocodeTransformSpy.mock.lastCall![0] as QueryInput;
    expect(chunk.data).toEqual({
      address: 'test3',
      searchTarget: SearchTarget.ALL,
      fuzzy: '?',
      tag: 'something',
    });

    // 入力値と同じ値が返ってくることを期待
    expect(result).toMatchObject(dummyResult);
  });

  // test('should involve the close() method', async () => {

  //   // closeメソッドをモック化
  //   const closeMock = jest.spyOn(WorkerThreadPool.prototype, 'close')

  //   // AbrGeocoderクラスの作成
  //   const abrGeocoder = new AbrGeocoder({
  //     container,
  //     maxConcurrency: 5,
  //   });

  //   // closeメソッドを実行
  //   await abrGeocoder.close();

  //   // モック化された close メソッドが実行されたことを確認
  //   expect(closeMock).toHaveBeenCalled();
  // });
});
