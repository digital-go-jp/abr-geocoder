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
import { WorkerThreadPool } from '@domain/services/thread/worker-thread-pool';
import { SingleBar } from 'cli-progress';
import path from 'node:path';
import { AbrGeocoderDiContainer, AbrGeocoderDiContainerParams } from '../models/abr-geocoder-di-container';
import { createCache, CreateCacheParams, CreateCacheResult } from './worker/create-geocode-caches-worker';
import { AbrAbortController } from '@domain/models/abr-abort-controller';

export const createGeocodeCaches = async ({
  container,
  progressBar,
  numOfThreads = 1,
}: {
  container: AbrGeocoderDiContainer;
  progressBar?: SingleBar;
  numOfThreads: number;
}) => {

  // LG_CODEの一覧を取得
  const db = await container.database.openCommonDb();
  const targets: CreateCacheParams[] = [
    {
      target: 'pref',
    },
    {
      target: 'county-and-city',
    },
    {
      target: 'city-and-ward',
    },
    {
      target: 'kyoto-street',
    },
    {
      target: 'oaza-cho',
    },
    {
      target: 'tokyo23-town',
    },
    {
      target: 'tokyo23-ward',
    },
    {
      target: 'ward',
    },
  ];
  const cities = await db.getCityList();
  for (const city of cities) {
    // RSDT_BLKテーブルのチェック
    const rsdtBlkDb = await container.database.openRsdtBlkDb({
      lg_code: city.lg_code,
      createIfNotExists: false,
    });
    if (rsdtBlkDb) {
      targets.push({
        target: 'rsdtblk',
        lg_code: city.lg_code,
      })
    }
    rsdtBlkDb?.close();

    // RSDT_DSPテーブルのチェック
    const rsdtDspDb = await container.database.openRsdtDspDb({
      lg_code: city.lg_code,
      createIfNotExists: false,
    });
    if (rsdtDspDb) {
      targets.push({
        target: 'rsdtdsp',
        lg_code: city.lg_code,
      })
    }
    rsdtDspDb?.close();

    // PARCELテーブルのチェック
    const parcelDb = await container.database.openParcelDb({
      lg_code: city.lg_code,
      createIfNotExists: false,
    });
    if (parcelDb) {
      targets.push({
        target: 'parcel',
        lg_code: city.lg_code,
      })
    }
    parcelDb?.close();
  }

  progressBar?.start(targets.length, 0);

  // jest で動かしている場合は、メインスレッドで処理する
  if (process.env.JEST_WORKER_ID) {
    let result: boolean = false;
    for (const task of targets) {
      result = await createCache({
        diContainer: container,
        data: task,
      });
      if (!result) {
        throw `Can not create the cache file for ${task.target}(${task.lg_code})`;
      }
    }
    return true;
  }
  const abortCtrl = new AbrAbortController();
  
  const pool = new WorkerThreadPool<AbrGeocoderDiContainerParams, CreateCacheParams, CreateCacheResult>({
    filename: path.join(__dirname, 'worker', 'create-geocode-caches-worker'),
    initData: container.toJSON(),
    maxConcurrency: numOfThreads,
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
        progressBar?.update(current);
        if (!result) {
          reject(`Can not create the cache file for ${task.target}(${task.lg_code})`);
          return;
        }
        
        if (current === targets.length) {
          resolve();
        }
      });
    }
  });
  
  progressBar?.stop();
  await pool.close();
  return true;
};
