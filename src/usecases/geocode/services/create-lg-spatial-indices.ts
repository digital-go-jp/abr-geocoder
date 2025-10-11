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
import BetterSqlite3 from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

/**
 * LGコード別DBに空間インデックスを作成
 */
export async function createLgSpatialIndices(dataDir: string, lgCode: string): Promise<boolean> {
  const dbPath = path.join(dataDir, `abrg-${lgCode}.sqlite`);
  
  if (!fs.existsSync(dbPath)) {
    return false;
  }
  
  const db = new BetterSqlite3(dbPath, { readonly: false });
  
  try {
    // WALモードを設定
    db.pragma('journal_mode = WAL');
    
    // rsdt_blk（住居表示ブロック）用空間インデックス
    const hasRsdtBlk = db.prepare(`
      SELECT COUNT(*) as cnt FROM sqlite_master 
      WHERE type='table' AND name='rsdt_blk'
    `).get() as { cnt: number };
    
    if (hasRsdtBlk.cnt > 0) {
      // 空間インデックステーブル作成
      db.prepare(`
        CREATE VIRTUAL TABLE IF NOT EXISTS rsdt_blk_spatial USING rtree(
          id INTEGER PRIMARY KEY,
          min_lat REAL,
          max_lat REAL,
          min_lon REAL,
          max_lon REAL
        )
      `).run();
      
      // 既存のインデックスをチェック
      const rsdtBlkSpatialCount = db.prepare('SELECT COUNT(*) as cnt FROM rsdt_blk_spatial').get() as { cnt: number };
      if (rsdtBlkSpatialCount.cnt === 0) {
        console.error(`[${lgCode}] rsdt_blk空間インデックスを構築中...`);
        db.prepare(`
          INSERT INTO rsdt_blk_spatial (id, min_lat, max_lat, min_lon, max_lon)
          SELECT 
            rowid,
            rep_lat as min_lat,
            rep_lat as max_lat,
            rep_lon as min_lon,
            rep_lon as max_lon
          FROM rsdt_blk
          WHERE rep_lat IS NOT NULL AND rep_lon IS NOT NULL
        `).run();
      }
    }
    
    // rsdt_dsp（住居表示番号）用空間インデックス
    const hasRsdtDsp = db.prepare(`
      SELECT COUNT(*) as cnt FROM sqlite_master 
      WHERE type='table' AND name='rsdt_dsp'
    `).get() as { cnt: number };
    
    if (hasRsdtDsp.cnt > 0) {
      db.prepare(`
        CREATE VIRTUAL TABLE IF NOT EXISTS rsdt_dsp_spatial USING rtree(
          id INTEGER PRIMARY KEY,
          min_lat REAL,
          max_lat REAL,
          min_lon REAL,
          max_lon REAL
        )
      `).run();
      
      const rsdtDspSpatialCount = db.prepare('SELECT COUNT(*) as cnt FROM rsdt_dsp_spatial').get() as { cnt: number };
      if (rsdtDspSpatialCount.cnt === 0) {
        console.error(`[${lgCode}] rsdt_dsp空間インデックスを構築中...`);
        db.prepare(`
          INSERT INTO rsdt_dsp_spatial (id, min_lat, max_lat, min_lon, max_lon)
          SELECT 
            rowid,
            rep_lat as min_lat,
            rep_lat as max_lat,
            rep_lon as min_lon,
            rep_lon as max_lon
          FROM rsdt_dsp
          WHERE rep_lat IS NOT NULL AND rep_lon IS NOT NULL
        `).run();
      }
    }
    
    // parcel（地番）用空間インデックス
    const hasParcel = db.prepare(`
      SELECT COUNT(*) as cnt FROM sqlite_master 
      WHERE type='table' AND name='parcel'
    `).get() as { cnt: number };
    
    if (hasParcel.cnt > 0) {
      db.prepare(`
        CREATE VIRTUAL TABLE IF NOT EXISTS parcel_spatial USING rtree(
          id INTEGER PRIMARY KEY,
          min_lat REAL,
          max_lat REAL,
          min_lon REAL,
          max_lon REAL
        )
      `).run();
      
      const parcelSpatialCount = db.prepare('SELECT COUNT(*) as cnt FROM parcel_spatial').get() as { cnt: number };
      if (parcelSpatialCount.cnt === 0) {
        console.error(`[${lgCode}] parcel空間インデックスを構築中...`);
        db.prepare(`
          INSERT INTO parcel_spatial (id, min_lat, max_lat, min_lon, max_lon)
          SELECT 
            rowid,
            rep_lat as min_lat,
            rep_lat as max_lat,
            rep_lon as min_lon,
            rep_lon as max_lon
          FROM parcel
          WHERE rep_lat IS NOT NULL AND rep_lon IS NOT NULL
        `).run();
      }
    }
    
    // インデックスと統計情報を更新
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_rsdt_blk_coordinates ON rsdt_blk(rep_lat, rep_lon)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_rsdt_dsp_coordinates ON rsdt_dsp(rep_lat, rep_lon)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_parcel_coordinates ON parcel(rep_lat, rep_lon)`).run();
    
    db.prepare(`ANALYZE`).run();
    
    console.error(`[${lgCode}] 空間インデックス作成完了`);
    return true;
    
  } catch (error) {
    console.error(`[${lgCode}] 空間インデックス作成エラー:`, error);
    return false;
  } finally {
    db.close();
  }
}

/**
 * すべてのLGコードDBに空間インデックスを作成
 */
export async function createAllLgSpatialIndices(dataDir: string): Promise<void> {
  const files = fs.readdirSync(dataDir);
  const lgCodes = files
    .filter(f => f.startsWith('abrg-') && f.endsWith('.sqlite'))
    .map(f => f.replace('abrg-', '').replace('.sqlite', ''));
  
  console.error(`${lgCodes.length}個のLGコードDBに空間インデックスを作成中...`);
  
  for (const lgCode of lgCodes) {
    await createLgSpatialIndices(dataDir, lgCode);
  }
  
  console.error('すべてのLGコードDBの空間インデックス作成完了');
}