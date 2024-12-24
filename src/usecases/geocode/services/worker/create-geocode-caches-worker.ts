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
import { CityAndWardTrieFinder } from '@usecases/geocode/models/city-and-ward-trie-finder';
import { CountyAndCityTrieFinder } from '@usecases/geocode/models/county-and-city-trie-finder';
import { KyotoStreetTrieFinder } from '@usecases/geocode/models/kyoto-street-trie-finder';
import { OazaChoTrieFinder } from '@usecases/geocode/models/oaza-cho-trie-finder';
import { Tokyo23TownTrieFinder } from '@usecases/geocode/models/tokyo23-town-finder';
import { Tokyo23WardTrieFinder } from '@usecases/geocode/models/tokyo23-ward-trie-finder';
import { WardTrieFinder } from '@usecases/geocode/models/ward-trie-finder';
import { isMainThread, MessagePort, parentPort, workerData } from "node:worker_threads";
import { AbrGeocoderDiContainer, AbrGeocoderDiContainerParams } from '../../models/abr-geocoder-di-container';
import { PrefTrieFinder } from '../../models/pref-trie-finder';
import { CreateCacheTaskData, CreateCacheTaskParams } from './create-cache-params';

const createPrefTrieData = async (task: CreateCacheTaskParams) => {
  
  let retry = 0;
  while (retry < 2) { 
    try {
      const data = await PrefTrieFinder.loadDataFile(task);
      return data !== undefined;
    } catch (_e: unknown) {
      // キャッシュを再作成する
      PrefTrieFinder.createDictionaryFile(task);
      retry++;
    }
  }
  return retry < 2;
};

const createCountyAndCityTrieData = async (task: CreateCacheTaskParams) => {
  
  let retry = 0;
  while (retry < 2) { 
    try {
      const data = await CountyAndCityTrieFinder.loadDataFile(task);
      return data !== undefined;
    } catch (_e: unknown) {
      // キャッシュを再作成する
      CountyAndCityTrieFinder.createDictionaryFile(task);
      retry++;
    }
  }
  return retry < 2;
};

const createCityAndWardTrieData = async (task: CreateCacheTaskParams) => {
  
  let retry = 0;
  while (retry < 2) { 
    try {
      const data = await CityAndWardTrieFinder.loadDataFile(task);
      return data !== undefined;
    } catch (_e: unknown) {
      // キャッシュを再作成する
      CityAndWardTrieFinder.createDictionaryFile(task);
      retry++;
    }
  }
  return retry < 2;
};

const createKyotoStreetTrieData = async (task: CreateCacheTaskParams) => {
  
  let retry = 0;
  while (retry < 2) { 
    try {
      const data = await KyotoStreetTrieFinder.loadDataFile(task);
      return data !== undefined;
    } catch (_e: unknown) {
      // キャッシュを再作成する
      KyotoStreetTrieFinder.createDictionaryFile(task);
      retry++;
    }
  }
  return retry < 2;
};

const createOazaChoTrieData = async (task: CreateCacheTaskParams) => {
  
  let retry = 0;
  while (retry < 2) { 
    try {
      const data = await OazaChoTrieFinder.loadDataFile(task);
      return data !== undefined;
    } catch (_e: unknown) {
      // キャッシュを再作成する
      OazaChoTrieFinder.createDictionaryFile(task);
      retry++;
    }
  }
  return retry < 2;
};

const createTokyo23TownTrieData = async (task: CreateCacheTaskParams) => {
  
  let retry = 0;
  while (retry < 2) { 
    try {
      const data = await Tokyo23TownTrieFinder.loadDataFile(task);
      return data !== undefined;
    } catch (_e: unknown) {
      // キャッシュを再作成する
      Tokyo23TownTrieFinder.createDictionaryFile(task);
      retry++;
    }
  }
  return retry < 2;
};

const createTokyo23WardTrieData = async (task: CreateCacheTaskParams) => {
  
  let retry = 0;
  while (retry < 2) { 
    try {
      const data = await Tokyo23WardTrieFinder.loadDataFile(task);
      return data !== undefined;
    } catch (_e: unknown) {
      // キャッシュを再作成する
      Tokyo23WardTrieFinder.createDictionaryFile(task);
      retry++;
    }
  }
  return retry < 2;
};

const createWardTrieData = async (task: CreateCacheTaskParams) => {
  
  let retry = 0;
  while (retry < 2) { 
    try {
      const data = await WardTrieFinder.loadDataFile(task);
      return data !== undefined;
    } catch (_e: unknown) {
      // キャッシュを再作成する
      WardTrieFinder.createDictionaryFile(task);
      retry++;
    }
  }
  return retry < 2;
};

export const createCache = async (params : CreateCacheTaskParams) => {
  switch (params.data.type) {
    case 'pref':
      return await createPrefTrieData(params);
    
    case 'county-and-city':
      return await createCountyAndCityTrieData(params);

    case 'city-and-ward':
      return await createCityAndWardTrieData(params);

    case 'kyoto-street':
      return await createKyotoStreetTrieData(params);

    case 'oaza-cho':
      return await createOazaChoTrieData(params);
      
    case 'tokyo23-town':
      return await createTokyo23TownTrieData(params);

    case 'tokyo23-ward':
      return await createTokyo23WardTrieData(params);

    case 'ward':
      return await createWardTrieData(params);
            
    default:
      throw `unknown target: ${params.data}`;
  }
};

export type CreateGeocodeCacheWorkerInitData = {
  diContainer: AbrGeocoderDiContainerParams;
  isSilentMode: boolean;
}
// 作業スレッド
if (!isMainThread && parentPort) {

  const initParams = workerData as CreateGeocodeCacheWorkerInitData;
  const diContainer = new AbrGeocoderDiContainer(initParams.diContainer);

  (async (parentPort: MessagePort) => {

    // メインスレッドからメッセージを受け取る
    parentPort.on('message', async (task: string) => {
      const received = JSON.parse(task) as ThreadJob<CreateCacheTaskData> | ThreadPing;
      (task as unknown) = null;
      switch (received.kind) {
        case 'ping': {
          parentPort.postMessage(JSON.stringify({
            kind: 'pong',
          }));
          return;
        }

        case 'task': {
          try {
            // キャッシュを作成する
            const result = await createCache({
              diContainer,
              data: received.data,
            });

            // メインスレッドに送る
            parentPort.postMessage(JSON.stringify({
              taskId: received.taskId,
              data: {
                target: received.data,
                result,
              },
              kind: 'result',
            }));
          } catch (e: unknown) {
            console.error(e);
            
            // メインスレッドに送る
            parentPort.postMessage(JSON.stringify({
              taskId: received.taskId,
              data: {
                target: received.data,
                result: false,
              },
              kind: 'result',
            }));
          }

          return;
        }

        default:
          console.error('not implemented')
          throw 'not implemented';
      }
    });

  })(parentPort);
}
