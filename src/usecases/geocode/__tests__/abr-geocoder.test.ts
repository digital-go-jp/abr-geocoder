import { WorkerThreadPool } from "@domain/services/thread/worker-thread-pool";
import { Sqlite3Params } from "@domain/types/database-params";
import { MatchLevel } from "@domain/types/geocode/match-level";
import { SearchTarget } from "@domain/types/search-target";
import { beforeAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { AbrGeocoder } from "../abr-geocoder";
import { AbrGeocoderDiContainer, AbrGeocoderDiContainerParams } from "../models/abr-geocoder-di-container";
import { QueryJson } from "../models/query";

// WorkerThreadPoolのモック化
//
// ■説明
// AbrGeocoderは WorkerThreadPoolを内部で生成する。
// privateプロパティに割り当てられるので、直接チェックすることはできない。
// そこで jest.fn() でモック化し、期待通りに値が渡されているかをテストする
jest.mock("@domain/services/thread/worker-thread-pool");

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
    dataDir: '~/.abr-geocoder/database',
    schemaDir: '../schema',
  };

  return {
    AbrGeocoderDiContainer: jest.fn().mockImplementation(() => {
      return {
        // seachTargetのデフォルト値
        searchTarget: SearchTarget.ALL,

        // モック化されたデータベース
        database: {
          connectParams: database,
        },

        // 使用しているので、モックの値を返す
        toJSON: jest.fn().mockReturnValue({
          database,
          debug: false,
        }),

        logger: undefined,
      };
    }),
  };
});
const container = new AbrGeocoderDiContainer({} as AbrGeocoderDiContainerParams);

describe('AbrGeocoder', () => {
  // jest.mock で自動モックされた WorkerThreadPool にアクセスする
  const MockedWorkerThreadPool = WorkerThreadPool as jest.MockedClass<typeof WorkerThreadPool>;

  beforeEach(() => {
    // テストごとにリセットする
    MockedWorkerThreadPool.mockReset();
  });

  beforeAll(() => {
    // DIコンテナが期待通りに生成されていることを確認
    expect(container.toJSON().database).toMatchObject({
      type: 'sqlite3',
      dataDir: '~/.abr-geocoder/database',
      schemaDir: '../schema',
    });
  })

  test('should create an instance correctly', () => {

    // AbrGeocoderクラスの作成
    new AbrGeocoder({
      container,
      maxConcurrency: 5,
    });

    // インスタンスが1つだけ生成されていることを確認
    expect(MockedWorkerThreadPool.mock.instances.length).toBe(1);
  });

  test('should involve the workerPool.run() method', async () => {

    const dummyResult: QueryJson = {
      ambiguousCnt: 0,
      fuzzy: '?',
      searchTarget: SearchTarget.ALL,
      city_key: undefined,
      pref_key: undefined,
      town_key: undefined,
      rsdtblk_key: undefined,
      rsdtdsp_key: undefined,
      matchedCnt: 0,
      startTime: 0,
      input: {
        data: {
          address: 'something',
          searchTarget: SearchTarget.ALL,
        },
        taskId: 123,
        lineId: 1,
      },
      tempAddress: 'something',
      pref: undefined,
      county: undefined,
      city: undefined,
      ward: undefined,
      oaza_cho: undefined,
      chome: undefined,
      koaza: undefined,
      lg_code: undefined,
      rep_lat: null,
      rep_lon: null,
      rsdt_addr_flg: undefined,
      machiaza_id: undefined,
      block: undefined,
      block_id: undefined,
      rsdt_num: undefined,
      rsdt_id: undefined,
      rsdt_num2: undefined,
      rsdt2_id: undefined,
      prc_id: undefined,
      prc_num1: undefined,
      prc_num2: undefined,
      prc_num3: undefined,
      parcel_key: undefined,
      match_level: MatchLevel.UNKNOWN,
      coordinate_level: MatchLevel.UNKNOWN,
    };

    // ジオコーディングした結果として、ダミーの値を返す
    const runMock = jest
      .spyOn(WorkerThreadPool.prototype, 'run')
      .mockReturnValue(Promise.resolve(dummyResult));

    // AbrGeocoderクラスの作成
    const abrGeocoder = new AbrGeocoder({
      container,
      maxConcurrency: 5,
    });

    // ジオコーディングを行う
    const result = await abrGeocoder.geocode({
      address: 'address',
      searchTarget: SearchTarget.ALL,
      fuzzy: '?',
      tag: 'something',
    });

    // workerThreadPool の run() が実行されたことを確認
    expect(runMock).toHaveBeenCalled();

    // 入力値と同じ値が返ってくることを期待
    expect(result).toMatchObject(dummyResult);
  });

  test('should involve the close() method', async () => {

    // closeメソッドをモック化
    const closeMock = jest.spyOn(WorkerThreadPool.prototype, 'close')

    // AbrGeocoderクラスの作成
    const abrGeocoder = new AbrGeocoder({
      container,
      maxConcurrency: 5,
    });

    // closeメソッドを実行
    await abrGeocoder.close();

    // モック化された close メソッドが実行されたことを確認
    expect(closeMock).toHaveBeenCalled();
  });
});
