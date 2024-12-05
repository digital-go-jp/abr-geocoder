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
import { AbrGeocoderDiContainer, AbrGeocoderDiContainerParams } from '../../models/abr-geocoder-di-container';
import { PrefTrieFinder } from '../../models/pref-trie-finder';
import { CountyAndCityTrieFinder } from '@usecases/geocode/models/county-and-city-trie-finder';
import { CityAndWardTrieFinder } from '@usecases/geocode/models/city-and-ward-trie-finder';
import { KyotoStreetTrieFinder } from '@usecases/geocode/models/kyoto-street-trie-finder';
import { OazaChoTrieFinder } from '@usecases/geocode/models/oaza-cho-trie-finder';
import { Tokyo23TownTrieFinder } from '@usecases/geocode/models/tokyo23-town-finder';
import { Tokyo23WardTrieFinder } from '@usecases/geocode/models/tokyo23-ward-trie-finder';
import { WardTrieFinder } from '@usecases/geocode/models/ward-trie-finder';
import { RsdtBlkTrieFinder } from '@usecases/geocode/models/rsdt-blk-trie-finder';
import { RsdtDspTrieFinder } from '@usecases/geocode/models/rsdt-dsp-trie-finder';
import { ParcelTrieFinder } from '@usecases/geocode/models/parcel-trie-finder';

export type ValidationParams = {
  target: 'pref' | 'county-and-city' | 'city-and-ward' | 'kyoto-street' | 'oaza-cho' | 'tokyo23-town' | 'tokyo23-ward' | 'ward' | 'rsdtblk' | 'rsdtdsp' | 'parcel';
  lg_code?: string;
};

export type ValidationResult = {
  result: boolean;
} & ValidationParams;

const createPrefTrieData = async (diContainer: AbrGeocoderDiContainer) => {
  
  let retry = 0;
  while (retry < 2) { 
    try {
      const data = await PrefTrieFinder.loadDataFile(diContainer);
      return data !== undefined;
    } catch (_e: unknown) {
      // キャッシュを再作成する
      PrefTrieFinder.createDictionaryFile(diContainer);
      retry++;
    }
  }
  return retry < 2;
};

const createCountyAndCityTrieData = async (diContainer: AbrGeocoderDiContainer) => {
  
  let retry = 0;
  while (retry < 2) { 
    try {
      const data = await CountyAndCityTrieFinder.loadDataFile(diContainer);
      return data !== undefined;
    } catch (_e: unknown) {
      // キャッシュを再作成する
      CountyAndCityTrieFinder.createDictionaryFile(diContainer);
      retry++;
    }
  }
  return retry < 2;
};

const createCityAndWardTrieData = async (diContainer: AbrGeocoderDiContainer) => {
  
  let retry = 0;
  while (retry < 2) { 
    try {
      const data = await CityAndWardTrieFinder.loadDataFile(diContainer);
      return data !== undefined;
    } catch (_e: unknown) {
      // キャッシュを再作成する
      CityAndWardTrieFinder.createDictionaryFile(diContainer);
      retry++;
    }
  }
  return retry < 2;
};

const createKyotoStreetTrieData = async (diContainer: AbrGeocoderDiContainer) => {
  
  let retry = 0;
  while (retry < 2) { 
    try {
      const data = await KyotoStreetTrieFinder.loadDataFile(diContainer);
      return data !== undefined;
    } catch (_e: unknown) {
      // キャッシュを再作成する
      KyotoStreetTrieFinder.createDictionaryFile(diContainer);
      retry++;
    }
  }
  return retry < 2;
};

const createOazaChoTrieData = async (diContainer: AbrGeocoderDiContainer) => {
  
  let retry = 0;
  while (retry < 2) { 
    try {
      const data = await OazaChoTrieFinder.loadDataFile(diContainer);
      return data !== undefined;
    } catch (_e: unknown) {
      // キャッシュを再作成する
      OazaChoTrieFinder.createDictionaryFile(diContainer);
      retry++;
    }
  }
  return retry < 2;
};

const createTokyo23TownTrieData = async (diContainer: AbrGeocoderDiContainer) => {
  
  let retry = 0;
  while (retry < 2) { 
    try {
      const data = await Tokyo23TownTrieFinder.loadDataFile(diContainer);
      return data !== undefined;
    } catch (_e: unknown) {
      // キャッシュを再作成する
      Tokyo23TownTrieFinder.createDictionaryFile(diContainer);
      retry++;
    }
  }
  return retry < 2;
};

const createTokyo23WardTrieData = async (diContainer: AbrGeocoderDiContainer) => {
  
  let retry = 0;
  while (retry < 2) { 
    try {
      const data = await Tokyo23WardTrieFinder.loadDataFile(diContainer);
      return data !== undefined;
    } catch (_e: unknown) {
      // キャッシュを再作成する
      Tokyo23WardTrieFinder.createDictionaryFile(diContainer);
      retry++;
    }
  }
  return retry < 2;
};

const createWardTrieData = async (diContainer: AbrGeocoderDiContainer) => {
  
  let retry = 0;
  while (retry < 2) { 
    try {
      const data = await WardTrieFinder.loadDataFile(diContainer);
      return data !== undefined;
    } catch (_e: unknown) {
      // キャッシュを再作成する
      WardTrieFinder.createDictionaryFile(diContainer);
      retry++;
    }
  }
  return retry < 2;
};
const createRsdtBlkTrieData = async (params: {
  diContainer: AbrGeocoderDiContainer;
  lg_code: string;
}) => {
  
  let retry = 0;
  while (retry < 2) { 
    try {
      const data = await RsdtBlkTrieFinder.loadDataFile(params);
      return data !== undefined;
    } catch (_e: unknown) {
      // キャッシュを再作成する
      RsdtBlkTrieFinder.createDictionaryFile(params);
      retry++;
    }
  }
  return retry < 2;
};

const createRsdtDspTrieData = async (params: {
  diContainer: AbrGeocoderDiContainer;
  lg_code: string;
}) => {
  
  let retry = 0;
  while (retry < 2) { 
    try {
      const data = await RsdtDspTrieFinder.loadDataFile(params);
      return data !== undefined;
    } catch (_e: unknown) {
      // キャッシュを再作成する
      RsdtDspTrieFinder.createDictionaryFile(params);
      retry++;
    }
  }
  return retry < 2;
};
const createParcelTrieData = async (params: {
  diContainer: AbrGeocoderDiContainer;
  lg_code: string;
}) => {
  
  let retry = 0;
  while (retry < 2) { 
    try {
      const data = await ParcelTrieFinder.loadDataFile(params);
      return data !== undefined;
    } catch (_e: unknown) {
      // キャッシュを再作成する
      ParcelTrieFinder.createDictionaryFile(params);
      retry++;
    }
  }
  return retry < 2;
};
// 作業スレッド
if (!isMainThread && parentPort) {

  const diContainerParams = workerData as AbrGeocoderDiContainerParams;
  const diContainer = new AbrGeocoderDiContainer(diContainerParams);

  (async (parentPort: MessagePort) => {

    // メインスレッドからメッセージを受け取る
    parentPort.on('message', async (task: string) => {
      const received = JSON.parse(task) as ThreadJob<ValidationParams> | ThreadPing;
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
            let result = false;
            switch (received.data.target) {
              case 'pref':
                result = await createPrefTrieData(diContainer);
                break;
              
              case 'county-and-city':
                result = await createCountyAndCityTrieData(diContainer);
                break;
          
              case 'city-and-ward':
                result = await createCityAndWardTrieData(diContainer);
                break;
          
              case 'kyoto-street':
                result = await createKyotoStreetTrieData(diContainer);
                break;
        
              case 'oaza-cho':
                result = await createOazaChoTrieData(diContainer);
                break;
      
              case 'tokyo23-town':
                result = await createTokyo23TownTrieData(diContainer);
                break;
    
              case 'tokyo23-ward':
                result = await createTokyo23WardTrieData(diContainer);
                break;

              case 'ward':
                result = await createWardTrieData(diContainer);
                break;
                      
              case 'rsdtblk':
                result = await createRsdtBlkTrieData({
                  diContainer,
                  lg_code: received.data.lg_code!,
                });
                break;
                      
              case 'rsdtdsp':
                result = await createRsdtDspTrieData({
                  diContainer,
                  lg_code: received.data.lg_code!,
                });
                break;

              case 'parcel':
                result = await createParcelTrieData({
                  diContainer,
                  lg_code: received.data.lg_code!,
                });
                break;
                        
              default:
                console.error(`unknown target: ${received.data.target}`);
                throw `unknown target: ${received.data.target}`;
            }

            // メインスレッドに送る
            parentPort.postMessage(JSON.stringify({
              taskId: received.taskId,
              data: {
                target: received.data.target,
                lg_code: received.data.lg_code,
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
                target: received.data.target,
                lg_code: received.data.lg_code,
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
