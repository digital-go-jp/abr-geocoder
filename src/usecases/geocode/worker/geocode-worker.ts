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
import { ThreadJob, ThreadPing } from '@domain/services/thread/thread-task';
import { isMainThread, MessagePort, parentPort, workerData } from "node:worker_threads";
import { Readable, Writable } from "stream";
import { AbrGeocoderDiContainer } from '../models/abr-geocoder-di-container';
import { AbrGeocoderInput } from '../models/abrg-input-data';
import { CityAndWardTrieFinder } from '../models/city-and-ward-trie-finder';
import { CountyAndCityTrieFinder } from '../models/county-and-city-trie-finder';
import { KyotoStreetTrieFinder } from '../models/kyoto-street-trie-finder';
import { OazaChoTrieFinder } from '../models/oaza-cho-trie-finder';
import { PrefTrieFinder } from '../models/pref-trie-finder';
import { Query } from '../models/query';
import { Tokyo23TownTrieFinder } from '../models/tokyo23-town-finder';
import { Tokyo23WardTrieFinder } from '../models/tokyo23-ward-trie-finder';
import { WardTrieFinder } from '../models/ward-trie-finder';
import { CityAndWardTransform } from '../steps/city-and-ward-transform';
import { CountyAndCityTransform } from '../steps/county-and-city-transform';
import { GeocodeResultTransform } from '../steps/geocode-result-transform';
import { KyotoStreetTransform } from '../steps/kyoto-street-transform';
import { NormalizeBanchomeTransform } from '../steps/normalize-banchome-transform';
import { NormalizeTransform } from '../steps/normalize-transform';
import { OazaChomeTransform } from '../steps/oaza-chome-transform';
import { ParcelTransform } from '../steps/parcel-transform';
import { PrefTransform } from '../steps/pref-transform';
import { RsdtBlkTransform } from '../steps/rsdt-blk-transform';
import { RsdtDspTransform } from '../steps/rsdt-dsp-transform';
import { Tokyo23TownTranform } from '../steps/tokyo23town-transform';
import { Tokyo23WardTranform } from '../steps/tokyo23ward-transform';
// import { WardAndOazaTransform } from '../steps/ward-and-oaza-transform';
// import { setFlagsFromString } from 'v8';
// import { runInNewContext } from 'vm';
import { fromSharedMemory } from '@domain/services/thread/shared-memory';
import { Duplex } from 'node:stream';
import { WardTransform } from '../steps/ward-transform';
import { GeocodeWorkerInitData } from './geocode-worker-init-data';
import { PrefLgCode } from '@domain/types/pref-lg-code';

export class GeocodeTransform extends Duplex {

  private readonly reader = new Readable({
    objectMode: true,
    read() {},
  });

  private constructor({
    diContainer,
    prefTrie,
    countyAndCityTrie,
    oazaChoTries,
    kyotoStreetTrie,
    cityAndWardTrie,
    wardTrie,
    tokyo23WardTrie,
    tokyo23TownTrie,
  }: {
    diContainer: AbrGeocoderDiContainer;
    prefTrie: PrefTrieFinder;
    countyAndCityTrie: CountyAndCityTrieFinder;
    oazaChoTries: Map<PrefLgCode, OazaChoTrieFinder>;
    kyotoStreetTrie: KyotoStreetTrieFinder;
    cityAndWardTrie: CityAndWardTrieFinder;
    wardTrie: WardTrieFinder;
    tokyo23WardTrie: Tokyo23WardTrieFinder;
    tokyo23TownTrie: Tokyo23TownTrieFinder;
  }) {
    super({
      objectMode: true,
      read() {},
      allowHalfOpen: true,
    });
    
    // 都道府県を試す
    const prefTransform = new PrefTransform(prefTrie);
    
    // 〇〇郡〇〇市を試す
    const countyAndCityTransform = new CountyAndCityTransform(countyAndCityTrie);

    // 〇〇市〇〇区を試す
    const cityAndWardTransform = new CityAndWardTransform(cityAndWardTrie);

    // 〇〇市 (〇〇郡が省略された場合）を試す
    // const wardAndOazaTransform = new WardAndOazaTransform(wardAndOazaTrie);

    // 大字を試す
    const oazaChomeTransform = new OazaChomeTransform(oazaChoTries);

    // 京都の通り名を試す
    const kyotoStreetTransform = new KyotoStreetTransform(kyotoStreetTrie);

    // 東京23区を試す
    // 〇〇区＋大字の組み合わせで探す
    const tokyo23TownTransform = new Tokyo23TownTranform(tokyo23TownTrie);

    // 東京23区を試す
    const tokyo23WardTransform = new Tokyo23WardTranform(tokyo23WardTrie);

    // 〇〇区で始まるパターン(東京23区以外)
    const wardTransform = new WardTransform(wardTrie);

    // 住所の正規化処理
    //
    // 例：
    //
    // 東京都千代田区紀尾井町1ー3 東京ガーデンテラス紀尾井町 19階、20階
    //  ↓
    // 東京都千代田区紀尾井町1{DASH}3{SPACE}東京ガーデンテラス紀尾井町{SPACE}19階、20階
    //
    const normalizeTransform = new NormalizeTransform();

    // 地番の特定を試みる
    const parcelTransform = new ParcelTransform(diContainer);

    // 街区符号の特定を試みる
    const rsdtBlkTransform = new RsdtBlkTransform(diContainer);

    // 住居番号の特定を試みる
    const rsdtDspTransform = new RsdtDspTransform(diContainer);

    // 正規表現で番地を試みる
    const normalizeBanchomeTransform = new NormalizeBanchomeTransform();

    // 最終的な結果にまとめる
    const geocodeResultTransform = new GeocodeResultTransform();

    const dst = new Writable({
      objectMode: true,
      write: (query: Query, _, callback) => {
        this.push(query);
        callback();
      },
    });

    this.reader.pipe(normalizeTransform)
      .pipe(normalizeBanchomeTransform)
      .pipe(prefTransform)
      .pipe(countyAndCityTransform)
      .pipe(cityAndWardTransform)
      .pipe(wardTransform)
      .pipe(tokyo23TownTransform)
      .pipe(tokyo23WardTransform)

      .pipe(kyotoStreetTransform)
      .pipe(oazaChomeTransform)
      .pipe(rsdtBlkTransform)
      .pipe(rsdtDspTransform)
      .pipe(parcelTransform)
      .pipe(geocodeResultTransform)
      .pipe(dst);
  }

  _write(chunk: AbrGeocoderInput, _: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.reader.push(chunk);
    callback();
  }

  _final(callback: (error?: Error | null) => void): void {
    this.reader.push(null);
    callback();
  }
 
  static readonly create = async (params: Required<GeocodeWorkerInitData>) => {
    const diContainer = new AbrGeocoderDiContainer(params.diContainer);

    const oazaChoTries = new Map<PrefLgCode, OazaChoTrieFinder>();
    params.trieData.oazaChomes.forEach(value => {
      oazaChoTries.set(value.lg_code, new OazaChoTrieFinder(fromSharedMemory(value.data)));
    });

    const result = new GeocodeTransform({
      diContainer,
      prefTrie: new PrefTrieFinder(fromSharedMemory(params.trieData.pref)),
      countyAndCityTrie: new CountyAndCityTrieFinder(fromSharedMemory(params.trieData.countyAndCity)),
      cityAndWardTrie: new CityAndWardTrieFinder(fromSharedMemory(params.trieData.cityAndWard)),
      kyotoStreetTrie: new KyotoStreetTrieFinder(fromSharedMemory(params.trieData.kyotoStreet)),
      oazaChoTries,
      wardTrie: new WardTrieFinder(fromSharedMemory(params.trieData.ward)),
      tokyo23WardTrie: new Tokyo23WardTrieFinder(fromSharedMemory(params.trieData.tokyo23Ward)),
      tokyo23TownTrie: new Tokyo23TownTrieFinder(fromSharedMemory(params.trieData.tokyo23Town)),
    });

    return result;
  };
}


// 作業スレッド
if (!isMainThread && parentPort) {
  // if (process.execArgv.includes("--inspect-brk")) {
  //   const port = (workerData as InitData).port;
  //   inspector.open(port);
  //   inspector.waitForDebugger();
  // }
    
  // setFlagsFromString('--expose_gc');
  // const gc = runInNewContext('gc'); // nocommit

  // setInterval(() => gc(), 5000);

  (async (parentPort: MessagePort) => {
    const reader = new Readable({
      objectMode: true,
      read() {},
    });

    const initData = workerData as GeocodeWorkerInitData;
    initData.debug = false;
    const geocodeTransform = await GeocodeTransform.create(initData);

    // メインスレッドからメッセージを受け取る
    parentPort.on('message', (task: string) => {
      const received = JSON.parse(task) as ThreadJob<AbrGeocoderInput> | ThreadPing;
      (task as unknown) = null;
      switch (received.kind) {
        case 'ping': {
          parentPort.postMessage(JSON.stringify({
            kind: 'pong',
          }));
          return;
        }

        case 'task': {
          // abr-geocoder.ts でメインスレッドでの処理とバックグラウンドでの処理を
          // 両方しようしているため、QueryInputが2重になってしまう。
          // ここでQueryInputの正しい形に直す
          reader.push(received);
          return;
        }

        default:
          throw 'not implemented';
      }
    });

    // geocodeTransform からの出力を
    // メインスレッドに送る
    const dst = new Writable({
      objectMode: true,
      write: (query: Query, _, callback) => {
        const data = query.toJSON();
        parentPort.postMessage(JSON.stringify({
          taskId: query.input.taskId,
          data,
          kind: 'result',
        }));
        query.release();
        callback();
      },
    });
    reader.pipe(geocodeTransform).pipe(dst);

  })(parentPort);
}
