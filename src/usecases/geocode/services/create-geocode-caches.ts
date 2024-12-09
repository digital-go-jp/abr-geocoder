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
import { AbrAbortController } from '@domain/models/abr-abort-controller';
import { createSingleProgressBar } from '@domain/services/progress-bars/create-single-progress-bar';
import { WorkerThreadPool } from '@domain/services/thread/worker-thread-pool';
import path from 'node:path';
import { AbrGeocoderDiContainer } from '../models/abr-geocoder-di-container';
import { CreateCacheResult, CreateCacheType } from './worker/create-cache-params';
import { createCache, CreateGeocodeCacheWorkerInitData } from './worker/create-geocode-caches-worker';

export const createGeocodeCaches = async ({
  container,
  numOfThreads = 1,
  isSilentMode = false,
}: {
  container: AbrGeocoderDiContainer;
  numOfThreads: number;
  isSilentMode: boolean;
}) => {

  // 初期化する
  const progressBar = isSilentMode ? undefined : createSingleProgressBar('prepare: {bar} {percentage}% | {value}/{total}');
  
  // LG_CODEの一覧を取得
  const targets: CreateCacheType[] = [
    'pref',
    'county-and-city',
    'city-and-ward',
    'kyoto-street',
    'oaza-cho',
    'tokyo23-town',
    'tokyo23-ward',
    'ward',
  ];

  progressBar?.start(targets.length, 0);

  // jest で動かしている場合は、メインスレッドで処理する
  if (process.env.JEST_WORKER_ID) {
    let result: boolean = false;
    for (const task of targets) {
      result = await createCache({
        diContainer: container,
        data: task,
        isSilentMode,
      });
      if (!result) {
        throw `Can not create the cache file for ${task}`;
      }
    }
    return true;
  }
  const abortCtrl = new AbrAbortController();
  
  const pool = new WorkerThreadPool<CreateGeocodeCacheWorkerInitData, CreateCacheType, CreateCacheResult>({
    filename: path.join(__dirname, 'worker', 'create-geocode-caches-worker'),
    initData: {
      diContainer: container.toJSON(),
      isSilentMode,
    },
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
          reject(`Can not create the cache file for ${task})`);
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
