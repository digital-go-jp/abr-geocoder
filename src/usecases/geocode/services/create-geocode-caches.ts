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
import { ProgressCallback } from '@config/progress-bar-formats';
import { AbrAbortController } from '@domain/models/abr-abort-controller';
import { WorkerThreadPool } from '@domain/services/thread/worker-thread-pool';
import path from 'node:path';
import { AbrGeocoderDiContainer } from '../models/abr-geocoder-di-container';
import { CreateCacheResult, CreateCacheTaskData } from './worker/create-cache-params';
import { createCache, CreateGeocodeCacheWorkerInitData } from './worker/create-geocode-caches-worker';

export const createGeocodeCaches = async ({
  container,
  maxConcurrency,
  progress,
}: {
  container: AbrGeocoderDiContainer;
  maxConcurrency: number;
  // 進み具合を示すプログレスのコールバック
  progress?: ProgressCallback;
}) => {

  // LG_CODEの一覧を取得
  const targets: CreateCacheTaskData[] = [
    {
      type: 'pref',
    },
    {
      type: 'county-and-city',
    },
    {
      type: 'city-and-ward',
    },
    {
      type: 'kyoto-street',
    },
    {
      type: 'tokyo23-town',
    },
    {
      type: 'tokyo23-ward',
    },
    {
      type: 'ward',
    },
  ];

  // 都道府県単位で大字・丁目・小字のキャッシュを作成
  const db = await container.database.openCommonDb();
  for (const prefInfo of await db.getPrefList()) {
    targets.push({
      type: 'oaza-cho',
      lg_code: prefInfo.lg_code,
    });
  }
  await db.close();

  // 進捗状況をコールバック
  if (progress) {
    progress(0, targets.length);
  }

  // jest で動かしている場合は、メインスレッドで処理する
  if (process.env.JEST_WORKER_ID) {
    let result: boolean = false;
    let current = 0;
    for (const task of targets) {
      result = await createCache({
        diContainer: container,
        data: task,
      });
      current++;

      // 進捗状況をコールバック
      if (progress) {
        progress(current, targets.length);
      }
      
      if (!result) {
        throw `Can not create the cache file for ${task}`;
      }
    }
    return true;
  }
  const abortCtrl = new AbrAbortController();
  
  const pool = await WorkerThreadPool.create<CreateGeocodeCacheWorkerInitData, CreateCacheTaskData, CreateCacheResult>({
    filename: path.join(__dirname, 'worker', 'create-geocode-caches-worker'),
    initData: {
      diContainer: container.toJSON(),
    },

    // 複数スレッドで処理
    maxConcurrency,

    // 複数スレッドで単発で処理したほうが
    // うまく分散されて早くなるので、maxTasksPerWorker = 1に固定
    maxTasksPerWorker: 1,
    signal: abortCtrl.signal,
  });
  let current = 0;
  await new Promise((
    resolve: (_?: unknown) => void,
    reject: (errorMsg: string) => void,
  ) => {
    for (const task of targets) {
      pool.run(task).then(result => {
        current++;

        // 進捗状況をコールバック
        if (progress) {
          progress(current, targets.length);
        }
        
        if (!result) {
          reject(`Can not create the cache file for ${task})`);
          return;
        }
        
        if (current === targets.length) {
          resolve();
        }
      });
    }
  });
  
  await pool.close();
  return true;
};
