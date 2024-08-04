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
import { DebugLogger } from '@domain/services/logger/debug-logger';
import { fromSharedMemory, toSharedMemory } from '@domain/services/thread/shared-memory';
import { ThreadJob, ThreadJobResult } from '@domain/services/thread/thread-task';
import { ICommonDbGeocode } from '@interface/database/common-db';
import { MessagePort } from 'node:worker_threads';
import { Readable, Writable } from "stream";
import { isMainThread, parentPort, workerData } from "worker_threads";
import { AbrGeocoderDiContainer, AbrGeocoderDiContainerParams } from '../models/abr-geocoder-di-container';
import { Query, QueryInput } from '../models/query';
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

export type GeocodeWorkerInitData = {
  containerParams: AbrGeocoderDiContainerParams,
}

export const geocodeOnWorkerThread = async (params: Required<{
  port: MessagePort;
  initData: GeocodeWorkerInitData;
}>) => {
  const container = new AbrGeocoderDiContainer(params.initData.containerParams);
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
    // 都道府県を試す
    commonDb.getPrefList().then(prefList => new PrefTransform({
      prefList,
      logger,
    })),

    // 〇〇郡〇〇市を試す
    commonDb.getCountyAndCityList().then(countyAndCityList => new CountyAndCityTransform({
      countyAndCityList,
      logger,
    })),

    // 〇〇市〇〇区を試す
    commonDb.getCityAndWardList().then(cityAndWardList => new CityAndWardTransform({
      cityAndWardList,
      logger,
    })),

    // 〇〇市 (〇〇郡が省略された場合）を試す
    commonDb.getWardAndOazaChoList().then(wardAndOazaList => new WardAndOazaTransform({
      wardAndOazaList,
      logger,
    })),
    
    // 大字を試す
    commonDb.getOazaChomes().then(oazaChomes => new OazaChomeTransform({
      oazaChomes,
      logger,
    })),

    // 東京23区を試す
    // 〇〇区＋大字の組み合わせで探す
    commonDb.getTokyo23Towns().then(tokyo23towns => new Tokyo23TownTranform({
      tokyo23towns,
      logger,
    })),

    // 東京23区を試す
    commonDb.getTokyo23Wards().then(tokyo23wards => new Tokyo23WardTranform({
      tokyo23wards,
      logger,
    })),
  
    // 〇〇区で始まるパターン(東京23区以外)
    commonDb.getWards().then(wards => new WardTransform({
      db: commonDb,
      wards,
      logger,
    })),
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
  });

  // 丁目を試す
  const chomeTransform = new ChomeTranform({
    db: commonDb,
    logger,
  });

  // 小字を試す
  const koazaTransform = new KoazaTransform({
    db: commonDb,
    logger,
  });
  
  // 地番の特定を試みる
  const parcelTransform = new ParcelTransform({
    dbCtrl,
    logger,
  });

  // 街区符号の特定を試みる
  const rsdtBlkTransform = new RsdtBlkTransform({
    dbCtrl,
    logger,
  });

  // 住居番号の特定を試みる
  const rsdtDspTransform = new RsdtDspTransform({
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
  params.port.on('message', (task: Uint8Array) => {
    const data = fromSharedMemory<ThreadJob<QueryInput>>(task);
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