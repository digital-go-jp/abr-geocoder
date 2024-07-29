
import { DebugLogger } from '@domain/services/logger/debug-logger';
import { fromSharedMemory, toSharedMemory } from '@domain/services/thread/shared-memory';
import { ThreadJob, ThreadJobResult } from '@domain/services/thread/thread-task';
import { SearchTarget } from '@domain/types/search-target';
import { ICommonDbGeocode } from '@interface/database/common-db';
import { MessagePort } from 'node:worker_threads';
import { Readable, Writable } from "stream";
import { isMainThread, parentPort, workerData } from "worker_threads";
import { GeocoderDiContainer, GeocoderDiContainerParams } from '../models/geocode-di-container';
import { Query } from '../models/query';
import { ChomeTranform } from '../steps/chome-transform';
import { CityAndWardTransform } from '../steps/city-and-ward-transform';
import { CountyAndCityTransform } from '../steps/county-and-city-transform';
import { GeocodeResultTransform } from '../steps/geocode-result-transform';
import { KoazaTransform } from '../steps/koaza-transform';
import { NormalizeTransform } from '../steps/normalize-transform';
import { OazaChomeTransform } from '../steps/oaza-chome-transform';
import { ParcelTransform } from '../steps/parcel-transform';
import { PrefTransform } from '../steps/pref-transform';
import { RegExTransform } from '../steps/regex-transform';
import { RsdtBlkTransform } from '../steps/rsdt-blk-transform';
import { RsdtDspTransform } from '../steps/rsdt-dsp-transform';
import { Tokyo23TownTranform } from '../steps/tokyo23town-transform';
import { Tokyo23WardTranform } from '../steps/tokyo23ward-transform';
import { WardAndOazaTransform } from '../steps/ward-and-oaza-transform';
import { WardTransform } from '../steps/ward-transform';
import { DEFAULT_FUZZY_CHAR } from '@config/constant-values';

export type GeocodeWorkerInitData = {
  containerParams: GeocoderDiContainerParams,
}

export const geocodeOnWorkerThread = async (params: Required<{
  port: MessagePort;
  initData: GeocodeWorkerInitData;
}>) => {
  const container = new GeocoderDiContainer(params.initData.containerParams);
  const fuzzy: string = container.fuzzy || DEFAULT_FUZZY_CHAR;
  const searchTarget: SearchTarget = container.searchTarget || SearchTarget.ALL;
  const dbCtrl = container.database;
  const commonDb: ICommonDbGeocode = await dbCtrl.openCommonDb();
  const logger: DebugLogger | undefined = container.logger;

  const start = Date.now();
  const [
    prefTransform,
    countyAndCityTransform,
    cityAndWardTransform,
    wardAndOazaTransform,
    oazaChomeTransform,
    tokyo23TownTransform,
    tokyo23WardTransform,
    wardTransform,
  ]: [
    PrefTransform,
    CountyAndCityTransform,
    CityAndWardTransform,
    WardAndOazaTransform,
    OazaChomeTransform,
    Tokyo23TownTranform,
    Tokyo23WardTranform,
    WardTransform,
  ] = await Promise.all([
    new Promise(async (resolve: (result: PrefTransform) => void) => {
      const prefList = await commonDb.getPrefList();
      resolve(new PrefTransform({
        prefList,
        fuzzy,
        logger,
      }));
    }),
    new Promise(async (resolve: (result: CountyAndCityTransform) => void) => {
      const countyAndCityList = await commonDb.getCountyAndCityList();
      resolve(new CountyAndCityTransform({
        countyAndCityList,
        fuzzy,
        logger,
      }));
    }),

    // 〇〇市〇〇区を試す
    new Promise(async (resolve: (result: CityAndWardTransform) => void) => {
      const cityAndWardList = await commonDb.getCityAndWardList();
      resolve(new CityAndWardTransform({
        cityAndWardList,
        fuzzy,
        logger,
      }));
    }),
    // 〇〇市 (〇〇郡が省略された場合）を試す
    new Promise(async (resolve: (result: WardAndOazaTransform) => void) => {
      const wardAndOazaList = await commonDb.getWardAndOazaChoList();
      resolve(new WardAndOazaTransform({
        wardAndOazaList,
        fuzzy,
        logger,
      }));
    }),
    // 大字を試す
    new Promise(async (resolve: (result: OazaChomeTransform) => void) => {
      const oazaChomes = await commonDb.getOazaChomes();
      resolve(new OazaChomeTransform({
        db: commonDb,
        oazaChomes,
        fuzzy,
        logger,
      }));
    }),

    // 東京23区を試す
    // 〇〇区＋大字の組み合わせで探す
    new Promise(async (resolve: (result: Tokyo23TownTranform) => void) => {
      const tokyo23towns = await commonDb.getTokyo23Towns();
      resolve(new Tokyo23TownTranform({
        fuzzy,
        tokyo23towns,
        logger,
      }));
    }),

    // 東京23区を試す
    new Promise(async (resolve: (result: Tokyo23WardTranform) => void) => {
      const tokyo23wards = await commonDb.getTokyo23Wards();
      resolve(new Tokyo23WardTranform({
        fuzzy,
        tokyo23wards,
        logger,
      }));
    }),
  
    // 〇〇区で始まるパターン(東京23区以外)
    new Promise(async (resolve: (result: WardTransform) => void) => {
      const wards = await commonDb.getWards();
      resolve(new WardTransform({
        db: commonDb,
        fuzzy,
        wards,
        logger,
      }));
    }),
  ]);

  // 住所の正規化処理
  //
  // 例：
  //
  // 東京都千代田区紀尾井町1ー3 東京ガーデンテラス紀尾井町 19階、20階
  //  ↓
  // 東京都千代田区紀尾井町1{DASH}3{SPACE}東京ガーデンテラス紀尾井町{SPACE}19階、20階
  //
  const normalizeTransform = new NormalizeTransform({
    logger,
    fuzzy,
  });

  // 丁目を試す
  const chomeTransform = new ChomeTranform({
    db: commonDb,
    fuzzy,
    logger,
  });

  // 小字を試す
  const koazaTransform = new KoazaTransform({
    db: commonDb,
    fuzzy,
    logger,
  });
  
  // 地番の特定を試みる
  const parcelTransform = new ParcelTransform({
    fuzzy,
    searchTarget,
    dbCtrl,
    logger,
  });

  // 街区符号の特定を試みる
  const rsdtBlkTransform = new RsdtBlkTransform({
    fuzzy,
    searchTarget,
    dbCtrl,
    logger,
  });

  // 住居番号の特定を試みる
  const rsdtDspTransform = new RsdtDspTransform({
    fuzzy,
    searchTarget,
    dbCtrl,
    logger,
  });

  // 正規表現での特定を試みる
  const regexTranfrorm = new RegExTransform({
    logger,
  });

  // 最終的な結果にまとめる
  const geocodeResultTransform = new GeocodeResultTransform();

  const reader = new Readable({
    objectMode: true,
    read() {},
  });

  // メインスレッドに結果を送信する
  const dst = new Writable({
    objectMode: true,
    write(query: Query, _, callback) {
      const data = query.toJSON();
      const sharedMemory = toSharedMemory<ThreadJobResult<any>>({
        taskId: query.input.taskId,
        data,
        kind: 'result',
      });
      params.port.postMessage(sharedMemory);
      callback();
    },
  });

  logger?.info(`init: ${Date.now() - start}`);
  reader.pipe(normalizeTransform)
    .pipe(prefTransform)
    .pipe(countyAndCityTransform)
    .pipe(cityAndWardTransform)
    .pipe(wardAndOazaTransform)
    .pipe(wardTransform)
    .pipe(tokyo23TownTransform)
    .pipe(tokyo23WardTransform)
    .pipe(oazaChomeTransform)
    .pipe(chomeTransform)
    .pipe(koazaTransform)
    .pipe(rsdtBlkTransform)
    .pipe(rsdtDspTransform)
    .pipe(parcelTransform)
    .pipe(regexTranfrorm)
    .pipe(geocodeResultTransform)
    .pipe(dst);

  // メインスレッドからメッセージを受け取る
  params.port.on('message', async (task: Uint8Array) => {
    const data = fromSharedMemory<ThreadJob<string>>(task);
    reader.push(data);
  });
};

// 作業スレッド
if (!isMainThread && parentPort) {
  // if (process.execArgv.includes("--inspect-brk")) {
  //   const port = (workerData as InitData).port;
  //   inspector.open(port);
  //   inspector.waitForDebugger();
  // }
  geocodeOnWorkerThread({
    port: parentPort,
    initData: workerData as GeocodeWorkerInitData,
  });
}