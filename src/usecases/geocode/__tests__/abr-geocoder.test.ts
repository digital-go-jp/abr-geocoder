import { WorkerThreadPool } from "@domain/services/thread/worker-thread-pool";
import { SearchTarget } from "@domain/types/search-target";
import { describe, expect, jest, test } from "@jest/globals";
// import { setImmediateSpy } from '@mock/global';
import { Transform } from "stream";
import { AbrGeocoder } from "../abr-geocoder";
import { AbrGeocoderDiContainer, AbrGeocoderDiContainerParams } from "../models/abr-geocoder-di-container";
import { GeocodeTransform } from "../worker/geocode-worker";

// @usecases/geocode/models/__mocks__/abr-geocoder-di-container
jest.mock("@usecases/geocode/models/abr-geocoder-di-container");

// @usecases/geocode/worker/__mocks__/geocode-worker
jest.mock("@usecases/geocode/worker/geocode-worker");

// @domain/services/thread/__mocks__/worker-thread-pool
jest.mock("@domain/services/thread/worker-thread-pool");

const container = new AbrGeocoderDiContainer({} as AbrGeocoderDiContainerParams);

describe('AbrGeocoder', () => {
  const mockedWorkerThreadPool = jest.mocked(WorkerThreadPool);

  // test('should create an instance correctly', async () => {

  //   // setImmediateをモック化する
  //   const mockSetImmediate = setImmediateSpy();

  //   // AbrGeocoderクラスの作成
  //   const instance = await AbrGeocoder.create({
  //     container,
  //     numOfThreads: 1,
  //   });

  //   // インスタンスが生成されていることを確認
  //   expect(instance).not.toBeUndefined();

  //   // create メソッドが呼ばれたことを確認
  //   const mockCreate = mockedWorkerThreadPool.create;
  //   expect(mockCreate).toHaveBeenCalled();
    
  //   // WorkerThread.create()に対して、適切なパラメータが渡されたかを確認する
  //   // maxTasksPerWorkerは、実験的に変更することもあるし
  //   // filename は固定なので、全ての引数をチェックする必要はない。
  //   // 外部からの指定値で変換するポイントだけを確認する
  //   const params = mockCreate.mock.calls[0][0];
  //   expect(params).toMatchObject({
  //     maxConcurrency: 1,
  //     initData: {
  //       containerParams: {
  //         database: {
  //           type: 'sqlite3',
  //           dataDir: '~/.abr-geocoder/database_test',
  //         },
  //         debug: false,
  //       },
  //     },
  //   });

  //   // setImmediateを元に戻す
  //   mockSetImmediate.mockRestore();
  // });

  // test.skip('should involve the workerPool.run() method', async () => {

  //   // setImmediateをモック化する
  //   const mockSetImmediate = setImmediateSpy();

  //   // AbrGeocoderクラスの作成
  //   const abrGeocoder = await AbrGeocoder.create({
  //     container,
  //     numOfThreads: 2,
  //   });

  //   // ジオコーディングを行う
  //   const input = {
  //     address: '/abr-geocoder/passthrough',
  //     searchTarget: SearchTarget.ALL,
  //     fuzzy: '?',
  //     tag: 'something',
  //   };
  //   const result = await abrGeocoder.geocode(input);

  //   // create メソッドが呼ばれたことを確認
  //   const mockCreate = mockedWorkerThreadPool.create;
  //   expect(mockCreate).toHaveBeenCalled();

  //   // workerThreadPool の run() が実行されたことを確認
  //   const mockPool = await (mockCreate.mock.results.at(-1)?.value) as { run: jest.Mock };
  //   expect(mockPool.run).toHaveBeenCalledWith(input);

  //   // 入力値と同じ値が返ってくることを期待
  //   expect(result).toMatchObject({
  //     input: {
  //       data: input,
  //     },
  //   });

  //   // setImmediateを元に戻す
  //   mockSetImmediate.mockRestore();
  // });


  test.skip('should involve the geocodeTransformOnMainThread.pipe() method', async () => {

    // AbrGeocoderクラスの作成
    const abrGeocoder = new AbrGeocoder({
      container,
      numOfThreads: 3,
    });

    // ジオコーディングを行う
    const input = {
      address: '/abr-geocoder/passthrough',
      searchTarget: SearchTarget.ALL,
      fuzzy: '?',
      tag: 'something',
    };
    const result = await abrGeocoder.geocode(input);

    // このテストでは、setImmediate()をモック化していないので、
    // メインスレッドのGeocodeTransformが使用されるはず。
    const mockGeoTransform = jest.mocked(GeocodeTransform);
    const mockCreate = mockGeoTransform.create;
    const mockPool = await (mockCreate.mock.results.at(-1)?.value) as jest.Mocked<Transform>;
    expect(mockPool._write).toBeCalled();

    const chunk = mockPool._write.mock.calls[0][0];
    expect(chunk).toMatchObject({
      data: input,
    });

    // 入力値と同じ値が返ってくることを期待
    expect(result).toMatchObject({
      input: {
        data: input,
      },
    });
  });

  // test('should involve the close() method', async () => {

  //   // setImmediateをモック化する
  //   const mockSetImmediate = setImmediateSpy();

  //   // AbrGeocoderクラスの作成
  //   const abrGeocoder = await AbrGeocoder.create({
  //     container,
  //     numOfThreads: 3,
  //   });

  //   // closeメソッドを実行
  //   await abrGeocoder.close();

  //   // create メソッドが呼ばれたことを確認
  //   const mockCreate = mockedWorkerThreadPool.close;
  //   expect(mockCreate).toHaveBeenCalled();

  //   // workerThreadPool の close() が実行されたことを確認
  //   const mockPool = await (mockCreate.mock.results.at(-1)?.value) as { close: jest.Mock };
  //   expect(mockPool.close).toHaveBeenCalled();

  //   // setImmediateを元に戻す
  //   mockSetImmediate.mockRestore();
  // });
});
