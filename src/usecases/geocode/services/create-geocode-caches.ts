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
import { createAllLgSpatialIndices } from './create-lg-spatial-indices';

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

  // 空間インデックス（R-tree）を作成
  // データベース構築完了後に自動実行

  // JESTテストモードでは空間インデックス作成をスキップ
  if (process.env.JEST_WORKER_ID) {
    return true;
  }

  try {
    // データベースを開く
    let db: any = null;

    try {
      db = await container.database.openCommonDb({ readonly: false });

      // 空間インデックスが既に存在するかチェック
      const spatialTableExists = (db as any).driver.prepare(
        "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name IN ('town_spatial', 'city_spatial')"
      ).get();

      if (spatialTableExists.count >= 2) {
        // 既に空間インデックスが存在する場合は、データが入っているか確認
        const townSpatialCount = (db as any).driver.prepare('SELECT COUNT(*) as cnt FROM town_spatial').get();
        const citySpatialCount = (db as any).driver.prepare('SELECT COUNT(*) as cnt FROM city_spatial').get();

        if (townSpatialCount.cnt > 0 && citySpatialCount.cnt > 0) {
          // 空間インデックスが既に構築済み
          await db.close();
          return true;
        }
      }

      // 空間インデックスが存在しないか、データが入っていない場合のみ作成
      if (!progress) {
        console.error('データベースインデックス構築完了。空間インデックス（R-tree）を作成中...');
      }

    } catch (e) {
      // データベースエラー
      if (db) {
        try {
          await db.close();
        } catch {}
      }
      // エラーの場合はスキップ（既存の動作を維持）
      return true;
    }

    if (!db) {
      return true;
    }

    // WALモードを設定して同時アクセスを改善
    (db as any).driver.pragma('journal_mode = WAL');

    // 町丁目用空間インデックス作成
    (db as any).driver.prepare(`
      CREATE VIRTUAL TABLE IF NOT EXISTS town_spatial USING rtree(
        id INTEGER PRIMARY KEY,
        min_lat REAL,
        max_lat REAL,
        min_lon REAL,
        max_lon REAL
      )
    `).run();
    
    // 既存のインデックスをチェックし、空の場合のみ作成
    const townSpatialCount = (db as any).driver.prepare('SELECT COUNT(*) as cnt FROM town_spatial').get();
    if (townSpatialCount.cnt === 0) {
      if (!progress) {
        console.error('町丁目空間インデックスを構築中...');
      }
      (db as any).driver.prepare(`
        INSERT INTO town_spatial (id, min_lat, max_lat, min_lon, max_lon)
        SELECT 
          rowid,
          rep_lat as min_lat,
          rep_lat as max_lat, 
          rep_lon as min_lon,
          rep_lon as max_lon
        FROM town 
        WHERE rep_lat IS NOT NULL AND rep_lon IS NOT NULL
      `).run();
    }

    // 市区町村用空間インデックス作成
    (db as any).driver.prepare(`
      CREATE VIRTUAL TABLE IF NOT EXISTS city_spatial USING rtree(
        id INTEGER PRIMARY KEY,
        min_lat REAL,
        max_lat REAL,
        min_lon REAL,
        max_lon REAL
      )
    `).run();
    
    // 既存のインデックスをチェックし、空の場合のみ作成
    const citySpatialCount = (db as any).driver.prepare('SELECT COUNT(*) as cnt FROM city_spatial').get();
    if (citySpatialCount.cnt === 0) {
      if (!progress) {
        console.error('市区町村空間インデックスを構築中...');
      }
      (db as any).driver.prepare(`
        INSERT INTO city_spatial (id, min_lat, max_lat, min_lon, max_lon)
        SELECT 
          rowid,
          rep_lat,
          rep_lat,
          rep_lon,
          rep_lon
        FROM city 
        WHERE rep_lat IS NOT NULL AND rep_lon IS NOT NULL
      `).run();
    }

    // 追加インデックスと統計
    (db as any).driver.prepare(`CREATE INDEX IF NOT EXISTS idx_town_coordinates ON town(rep_lat, rep_lon)`).run();
    (db as any).driver.prepare(`CREATE INDEX IF NOT EXISTS idx_city_coordinates ON city(rep_lat, rep_lon)`).run();
    (db as any).driver.prepare(`ANALYZE town_spatial`).run();
    (db as any).driver.prepare(`ANALYZE city_spatial`).run();
    (db as any).driver.prepare(`ANALYZE town`).run();
    (db as any).driver.prepare(`ANALYZE city`).run();

    await db.close();
    
    // LGコード別DBの空間インデックスも作成
    if (!progress) {
      console.error('LGコード別DBの空間インデックスを作成中...');
    }
    const dbParams = container.database.connectParams;
    if (dbParams.type === 'sqlite3') {
      await createAllLgSpatialIndices(dbParams.dataDir);
    }
    
    console.log('空間インデックス作成完了！逆ジオコーディングが高速化されました。');
  } catch (error) {
    // 空間インデックス作成に失敗してもキャッシュ作成全体を失敗させない
    console.warn('空間インデックス作成に失敗しました:', error);
    console.log('ハヴァーサイン公式による逆ジオコーディングは引き続き利用可能です。');
  }
  
  return true;
};
