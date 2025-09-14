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
import { isMainThread, MessagePort, parentPort, workerData } from 'node:worker_threads';
import { Readable, Writable, Duplex } from 'node:stream';
import { ReverseGeocodeWorkerInitData, ReverseGeocodeWorkerInput } from './reverse-geocode-worker-init-data';
import { GeocodeDbController } from '@drivers/database/geocode-db-controller';
import { SearchTarget } from '@domain/types/search-target';
import { MatchLevel } from '@domain/types/geocode/match-level';
import { AbrgError, AbrgErrorLevel } from '@domain/types/messages/abrg-error';
import { AbrgMessage } from '@domain/types/messages/abrg-message';
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

// 逆ジオコーディング結果の型定義
interface ReverseGeocodeResult {
  output: string;
  match_level: MatchLevel;
  coordinate_level: MatchLevel;
  lat: number;
  lon: number;
  lg_code?: string;
  machiaza_id?: string;
  blk_id?: string;
  rsdt_id?: string;
  rsdt2_id?: string;
  prc_id?: string;
  pref?: string;
  city?: string;
  county?: string;
  ward?: string;
  oaza_cho?: string;
  chome?: string;
  koaza?: string;
  blk_num?: string;
  rsdt_num?: string;
  rsdt_num2?: string;
  prc_num1?: string;
  prc_num2?: string;
  prc_num3?: string;
  distance?: number;
  score?: number;
  formatted?: {
    address: string;
    score: number;
    pref?: string;
    city?: string;
    town?: string;
    chome?: string;
    koaza?: string;
    other?: string | null;
  };
}

export class ReverseGeocodeTransform extends Duplex {
  private readonly geocodeDbController: GeocodeDbController;
  private readonly useSpatialIndex: boolean;
  private readonly better_sqlite3: typeof Database;
  private readonly dbDir: string;
  private commonDb: any;

  private constructor({
    geocodeDbController,
    useSpatialIndex,
  }: {
    geocodeDbController: GeocodeDbController;
    useSpatialIndex: boolean;
  }) {
    super({
      objectMode: true,
      read() {},
      allowHalfOpen: true,
    });

    this.geocodeDbController = geocodeDbController;
    this.useSpatialIndex = useSpatialIndex;
    this.better_sqlite3 = Database;
    this.dbDir = path.join(process.cwd(), 'db');
  }

  static async create(params: ReverseGeocodeWorkerInitData): Promise<ReverseGeocodeTransform> {
    const geocodeDbController = new GeocodeDbController({
      connectParams: params.database,
    });

    return new ReverseGeocodeTransform({
      geocodeDbController,
      useSpatialIndex: params.useSpatialIndex,
    });
  }

  async _write(
    chunk: ThreadJob<ReverseGeocodeWorkerInput>,
    _: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): Promise<void> {
    try {
      const input = chunk.data;
      const results = await this.performReverseGeocode(input);

      this.push({
        taskId: chunk.taskId,
        results,
      });

      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  private async performReverseGeocode(input: ReverseGeocodeWorkerInput): Promise<ReverseGeocodeResult[]> {
    const { lat, lon, searchTarget, limit, useSpatialIndex } = input;

    // パラメータ検証
    if (isNaN(lat) || lat < -90 || lat > 90) {
      throw new AbrgError({
        messageId: AbrgMessage.REVERSE_GEOCODE_COORDINATE_INVALID,
        level: AbrgErrorLevel.ERROR,
      });
    }

    if (isNaN(lon) || lon < -180 || lon > 180) {
      throw new AbrgError({
        messageId: AbrgMessage.REVERSE_GEOCODE_COORDINATE_INVALID,
        level: AbrgErrorLevel.ERROR,
      });
    }

    // inputから受け取ったuseSpatialIndexを使用（デフォルトはコンストラクタ時の値）
    const useIndex = useSpatialIndex ?? this.useSpatialIndex;

    if (useIndex) {
      return await this.reverseGeocodeWithSpatialIndex({ lat, lon, searchTarget, limit });
    } else {
      return await this.reverseGeocodeHaversine({ lat, lon, searchTarget, limit });
    }
  }

  private async reverseGeocodeWithSpatialIndex(params: {
    lat: number;
    lon: number;
    searchTarget: SearchTarget;
    limit: number;
  }): Promise<ReverseGeocodeResult[]> {
    const { lat, lon, limit } = params;
    const results: ReverseGeocodeResult[] = [];

    // 共通データベースから検索
    const commonDb = await this.geocodeDbController.openCommonDb();
    this.commonDb = commonDb;

    try {
      // Phase 1: 町丁目レベルの空間検索
      const townResults = await this.searchTownSpatial(commonDb, lat, lon, limit * 2);
      results.push(...townResults);

      // LGコード抽出
      const lgCodes = Array.from(new Set(
        townResults.map(r => r.lg_code).filter((code): code is string => !!code),
      )).slice(0, 3);

      // Phase 3: 詳細レベルの検索（住居表示・地番）
      if (lgCodes.length > 0) {
        const detailedResults = await this.searchDetailedAddresses(lat, lon, lgCodes, limit);
        results.push(...detailedResults);
      }

      // Phase 2: 市区町村レベルの空間検索（必要に応じて）
      if (results.length < limit) {
        const cityResults = await this.searchCitySpatial(commonDb, lat, lon, limit);
        results.push(...cityResults);
      }
    } finally {
      await commonDb.close();
    }

    // スコアリングと優先順位付け
    return this.prioritizeResults(results, limit);
  }

  private async reverseGeocodeHaversine(params: {
    lat: number;
    lon: number;
    searchTarget: SearchTarget;
    limit: number;
  }): Promise<ReverseGeocodeResult[]> {
    const { lat, lon, limit } = params;
    const results: ReverseGeocodeResult[] = [];

    // 共通データベースから検索
    const commonDb = await this.geocodeDbController.openCommonDb();
    this.commonDb = commonDb;

    try {
      // ハヴァーサイン公式による総なめ検索
      const distanceSQL = this.getHaversineDistanceSQL();

      // 町丁目検索
      const townSql = `
        SELECT t.*,
          ${distanceSQL} AS distance
        FROM town t
        WHERE ${distanceSQL} < 5000
        ORDER BY distance
        LIMIT ?
      `;

      const townRows = (commonDb as any).prepare(townSql).all(
        lat, lon, lat, // 距離計算用
        lat, lon, lat, // WHERE句用
        limit * 2,
      );

      for (const row of townRows) {
        // city_keyを使ってcityテーブルから市区町村情報を取得
        const cityInfo = await this.getCityInfoByCityKey(commonDb, row.city_key);

        const enrichedRow = {
          ...row,
          lg_code: cityInfo?.lg_code,
          pref: cityInfo?.pref,
          county: cityInfo?.county,
          city: cityInfo?.city,
          ward: cityInfo?.ward,
        };

        results.push(this.createResultFromRow(enrichedRow, MatchLevel.MACHIAZA));
      }

      // LGコード抽出して詳細検索
      const lgCodes = Array.from(new Set(
        results.map(r => r.lg_code).filter((code): code is string => !!code),
      )).slice(0, 3);

      if (lgCodes.length > 0) {
        const detailedResults = await this.searchDetailedAddresses(lat, lon, lgCodes, limit);
        results.push(...detailedResults);
      }
    } finally {
      await commonDb.close();
    }

    return this.prioritizeResults(results, limit);
  }

  private async searchDetailedAddresses(
    lat: number,
    lon: number,
    lgCodes: string[],
    limit: number,
  ): Promise<any[]> {
    const results: any[] = [];

    for (const lgCode of lgCodes.slice(0, 3)) { // 最も近い3つのLGコードのみ
      try {
        // 住居表示データの検索
        const rsdtResults = await this.searchResidentialDetail(lgCode, lat, lon, limit);
        results.push(...rsdtResults);

        // 地番データの検索
        const parcelResults = await this.searchParcelDetail(lgCode, lat, lon, limit);
        results.push(...parcelResults);

        if (results.length >= limit) break;
      } catch {
        // エラーは無視して続行
        continue;
      }
    }

    // 距離順にソート
    return results
      .sort((a, b) => (a.distance || 0) - (b.distance || 0))
      .slice(0, limit);
  }

  private async searchResidentialDetail(lgCode: string, lat: number, lon: number, limit: number): Promise<any[]> {
    const dbPath = path.join(this.dbDir, 'database', `abrg-${lgCode}.sqlite`);
    if (!fs.existsSync(dbPath)) return [];

    const db = this.better_sqlite3(dbPath, { readonly: true });
    const results: any[] = [];

    try {
      // rsdt_dspテーブルが存在するか確認
      const hasRsdtDsp = this.checkTableExists(db, 'rsdt_dsp');

      if (hasRsdtDsp) {
        // rsdt_dsp_spatialインデックスの確認
        const hasSpatialIndex = this.checkTableExists(db, 'rsdt_dsp_spatial');

        if (hasSpatialIndex) {
          // 空間インデックスを使用した検索
          const sql = `
            SELECT
              rd.rsdt_id, rd.rsdt2_id, rd.rsdt_num, rd.rsdt_num2,
              rd.rep_lat, rd.rep_lon, rb.blk_id, rb.blk_num, rb.town_key,
              (6371000 * acos(
                cos(radians(?)) * cos(radians(rd.rep_lat)) *
                cos(radians(rd.rep_lon) - radians(?)) +
                sin(radians(?)) * sin(radians(rd.rep_lat))
              )) AS distance
            FROM rsdt_dsp rd
            LEFT JOIN rsdt_blk rb ON rd.rsdtblk_key = rb.rsdtblk_key
            JOIN rsdt_dsp_spatial rds ON rd.rowid = rds.id
            WHERE rds.min_lat BETWEEN ? - 0.01 AND ? + 0.01
              AND rds.min_lon BETWEEN ? - 0.01 AND ? + 0.01
            ORDER BY distance
            LIMIT ?
          `;

          const rows = db.prepare(sql).all(
            lat, lon, lat,  // 距離計算用
            lat, lat,        // 緯度範囲
            lon, lon,        // 経度範囲
            limit,
          ) as any[];

          for (const row of rows) {
            const townInfo = this.getTownInfoByKey(this.commonDb, row.town_key);
            const cityInfo = this.getCityInfoByCityKey(this.commonDb, townInfo?.city_key);
            const address = this.formatDetailedAddress(cityInfo, townInfo, row);

            results.push({
              ...row,
              ...cityInfo,
              ...townInfo,
              output: address,  // outputフィールドとして設定
              lg_code: lgCode,
              match_level: MatchLevel.RESIDENTIAL_DETAIL,
            });
          }
        }
      } else {
        // rsdt_blkテーブルで検索
        const hasRsdtBlk = this.checkTableExists(db, 'rsdt_blk');
        if (hasRsdtBlk) {
          const hasSpatialIndex = this.checkTableExists(db, 'rsdt_blk_spatial');

          if (hasSpatialIndex) {
            const sql = `
              SELECT
                r.rsdtblk_key, r.town_key, r.blk_id, r.blk_num,
                r.rep_lat, r.rep_lon,
                (6371000 * acos(
                  cos(radians(?)) * cos(radians(r.rep_lat)) *
                  cos(radians(r.rep_lon) - radians(?)) +
                  sin(radians(?)) * sin(radians(r.rep_lat))
                )) AS distance
              FROM rsdt_blk r
              JOIN rsdt_blk_spatial rs ON r.rowid = rs.id
              WHERE rs.min_lat BETWEEN ? - 0.01 AND ? + 0.01
                AND rs.min_lon BETWEEN ? - 0.01 AND ? + 0.01
              ORDER BY distance
              LIMIT ?
            `;

            const rows = db.prepare(sql).all(
              lat, lon, lat,  // 距離計算用
              lat, lat,        // 緯度範囲
              lon, lon,        // 経度範囲
              limit,
            ) as any[];

            for (const row of rows) {
              const townInfo = this.getTownInfoByKey(this.commonDb, row.town_key);
              const cityInfo = this.getCityInfoByCityKey(this.commonDb, townInfo?.city_key);
              const address = this.formatDetailedAddress(cityInfo, townInfo, row);

              results.push({
                ...row,
                ...cityInfo,
                ...townInfo,
                output: address,  // outputフィールドとして設定
                lg_code: lgCode,
                match_level: MatchLevel.RESIDENTIAL_BLOCK,
              });
            }
          }
        }
      }
    } finally {
      db.close();
    }

    return results;
  }

  private async searchParcelDetail(lgCode: string, lat: number, lon: number, limit: number): Promise<any[]> {
    const dbPath = path.join(this.dbDir, 'database', `abrg-${lgCode}.sqlite`);
    if (!fs.existsSync(dbPath)) return [];

    const db = this.better_sqlite3(dbPath, { readonly: true });
    const results: any[] = [];

    try {
      // parcelテーブルが存在するか確認
      const hasParcel = this.checkTableExists(db, 'parcel');
      if (!hasParcel) return [];

      // parcel_spatialインデックスの確認
      const hasSpatialIndex = this.checkTableExists(db, 'parcel_spatial');

      if (hasSpatialIndex) {
        // 空間インデックスを使用した検索
        const sql = `
          SELECT
            p.parcel_key, p.town_key, p.prc_id,
            p.prc_num1, p.prc_num2, p.prc_num3,
            p.rep_lat, p.rep_lon,
            (6371000 * acos(
              cos(radians(?)) * cos(radians(p.rep_lat)) *
              cos(radians(p.rep_lon) - radians(?)) +
              sin(radians(?)) * sin(radians(p.rep_lat))
            )) AS distance
          FROM parcel p
          JOIN parcel_spatial ps ON p.rowid = ps.id
          WHERE ps.min_lat BETWEEN ? - 0.01 AND ? + 0.01
            AND ps.min_lon BETWEEN ? - 0.01 AND ? + 0.01
          ORDER BY distance
          LIMIT ?
        `;

        const rows = db.prepare(sql).all(
          lat, lon, lat,  // 距離計算用
          lat, lat,        // 緯度範囲
          lon, lon,        // 経度範囲
          limit,
        ) as any[];

        for (const row of rows) {
          const townInfo = this.getTownInfoByKey(this.commonDb, row.town_key);
          const cityInfo = this.getCityInfoByCityKey(this.commonDb, townInfo?.city_key);
          const address = this.formatParcelAddress(cityInfo, townInfo, row);

          results.push({
            ...row,
            ...cityInfo,
            ...townInfo,
            output: address,  // outputフィールドとして設定
            lg_code: lgCode,
            match_level: MatchLevel.PARCEL,
          });
        }
      }
    } finally {
      db.close();
    }

    return results;
  }

  // ヘルパーメソッド
  private getTownInfoByKey(db: any, townKey: number | null) {
    if (!townKey) return null;

    try {
      return db.prepare(`
        SELECT *
        FROM town
        WHERE town_key = ?
      `).get(townKey);
    } catch {
      return null;
    }
  }

  private checkTableExists(db: any, tableName: string): boolean {
    try {
      const result = db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      ).get(tableName);
      return !!result;
    } catch {
      return false;
    }
  }

  private formatDetailedAddress(cityInfo: any, townInfo: any, row: any): string {
    let address = '';
    if (cityInfo?.pref) address += cityInfo.pref;
    if (cityInfo?.county) address += cityInfo.county;
    if (cityInfo?.city) address += cityInfo.city;
    if (cityInfo?.ward) address += cityInfo.ward;
    if (townInfo?.oaza_cho) address += townInfo.oaza_cho;
    if (townInfo?.chome) address += townInfo.chome;
    if (townInfo?.koaza) address += townInfo.koaza;
    if (row.blk_num) address += row.blk_num;
    if (row.rsdt_num) {
      address += '-' + row.rsdt_num;
      if (row.rsdt_num2) address += '-' + row.rsdt_num2;
    }
    return address;
  }

  private formatParcelAddress(cityInfo: any, townInfo: any, row: any): string {
    let address = '';
    if (cityInfo?.pref) address += cityInfo.pref;
    if (cityInfo?.county) address += cityInfo.county;
    if (cityInfo?.city) address += cityInfo.city;
    if (cityInfo?.ward) address += cityInfo.ward;
    if (townInfo?.oaza_cho) address += townInfo.oaza_cho;
    if (townInfo?.chome) address += townInfo.chome;
    if (townInfo?.koaza) address += townInfo.koaza;
    if (row.prc_num1) {
      address += row.prc_num1;
      if (row.prc_num2) {
        address += '-' + row.prc_num2;
        if (row.prc_num3) {
          address += '-' + row.prc_num3;
        }
      }
    }
    return address;
  }

  private getHaversineDistanceSQL(): string {
    return `(6371000 * acos(
      cos(radians(?)) * cos(radians(t.rep_lat)) *
      cos(radians(t.rep_lon) - radians(?)) +
      sin(radians(?)) * sin(radians(t.rep_lat))
    ))`;
  }

  private async searchTownSpatial(db: any, lat: number, lon: number, limit: number): Promise<ReverseGeocodeResult[]> {
    const results: ReverseGeocodeResult[] = [];
    const radius = 0.05; // 約5km

    const sql = `
      SELECT t.*,
        (6371000 * acos(
          cos(radians(?)) * cos(radians(t.rep_lat)) *
          cos(radians(t.rep_lon) - radians(?)) +
          sin(radians(?)) * sin(radians(t.rep_lat))
        )) AS distance
      FROM town t
      JOIN town_spatial ts ON t.rowid = ts.id
      WHERE ts.min_lat BETWEEN ? - ? AND ? + ?
        AND ts.min_lon BETWEEN ? - ? AND ? + ?
      ORDER BY distance
      LIMIT ?
    `;

    const rows = db.prepare(sql).all(
      lat, lon, lat,           // 距離計算
      lat, radius, lat, radius, // 緯度範囲
      lon, radius, lon, radius, // 経度範囲
      limit,
    );

    for (const row of rows) {
      // city_keyを使ってcityテーブルから市区町村情報を取得
      const cityInfo = this.getCityInfoByCityKey(db, row.city_key);

      const enrichedRow = {
        ...row,
        lg_code: cityInfo?.lg_code,
        pref: cityInfo?.pref,
        county: cityInfo?.county,
        city: cityInfo?.city,
        ward: cityInfo?.ward,
      };

      results.push(this.createResultFromRow(enrichedRow, MatchLevel.MACHIAZA));
    }

    return results;
  }

  private async searchCitySpatial(db: any, lat: number, lon: number, limit: number): Promise<ReverseGeocodeResult[]> {
    const results: ReverseGeocodeResult[] = [];
    const radius = 0.1; // 約10km

    const sql = `
      SELECT c.*, p.pref,
        (6371000 * acos(
          cos(radians(?)) * cos(radians(c.rep_lat)) *
          cos(radians(c.rep_lon) - radians(?)) +
          sin(radians(?)) * sin(radians(c.rep_lat))
        )) AS distance
      FROM city c
      JOIN city_spatial cs ON c.rowid = cs.id
      LEFT JOIN pref p ON c.pref_key = p.pref_key
      WHERE cs.min_lat BETWEEN ? - ? AND ? + ?
        AND cs.min_lon BETWEEN ? - ? AND ? + ?
      ORDER BY distance
      LIMIT ?
    `;

    const rows = db.prepare(sql).all(
      lat, lon, lat,           // 距離計算
      lat, radius, lat, radius, // 緯度範囲
      lon, radius, lon, radius, // 経度範囲
      limit,
    );

    for (const row of rows) {
      results.push(this.createResultFromRow(row, MatchLevel.CITY));
    }

    return results;
  }

  private createResultFromRow(row: any, matchLevel: MatchLevel): ReverseGeocodeResult {
    // lg_codeを取得
    const lgCode = row.lg_code || row.machiaza_id?.substring(0, 6);

    // データベースから取得した値を使用
    const pref = row.pref || '';
    const city = row.city || '';
    const county = row.county || '';
    const ward = row.ward || '';
    const formattedAddress = this.formatAddress(row);

    return {
      output: formattedAddress,
      match_level: matchLevel,
      coordinate_level: matchLevel,
      lat: row.rep_lat,
      lon: row.rep_lon,
      lg_code: lgCode,
      machiaza_id: row.machiaza_id,
      blk_id: row.blk_id,
      rsdt_id: row.rsdt_id,
      rsdt2_id: row.rsdt2_id,
      prc_id: row.prc_id,
      pref: pref,
      city: city,
      county: county,
      ward: ward,
      oaza_cho: row.oaza_cho,
      chome: row.chome,
      koaza: row.koaza,
      blk_num: row.blk_num,
      rsdt_num: row.rsdt_num,
      rsdt_num2: row.rsdt_num2,
      prc_num1: row.prc_num1,
      prc_num2: row.prc_num2,
      prc_num3: row.prc_num3,
      distance: row.distance,
      // scoreフィールドは不要（逆ジオコーディングではnull）
    };
  }

  private formatAddress(row: any): string {
    let address = '';

    if (row.pref) address += row.pref;
    if (row.county) address += row.county;
    if (row.city) address += row.city;
    if (row.ward) address += row.ward;
    if (row.oaza_cho) address += row.oaza_cho;
    if (row.chome) address += row.chome;
    if (row.koaza) address += row.koaza;
    if (row.blk_num) address += row.blk_num;
    if (row.rsdt_num) {
      address += '-' + row.rsdt_num;
      if (row.rsdt_num2) address += '-' + row.rsdt_num2;
    }
    if (row.prc_num1) {
      address += row.prc_num1;
      if (row.prc_num2) address += '-' + row.prc_num2;
      if (row.prc_num3) address += '-' + row.prc_num3;
    }

    return address;
  }

  /**
   * 市区町村情報を取得する共通メソッド（city_key版）
   */
  private getCityInfoByCityKey(db: any, cityKey: number) {
    try {
      if (!cityKey) return null;

      const result = db.prepare(`
        SELECT c.lg_code, c.city, c.county, c.ward, p.pref
        FROM city c
        JOIN pref p ON c.pref_key = p.pref_key
        WHERE c.city_key = ?
      `).get(cityKey);

      return result || null;
    } catch (error) {
      console.error('Error fetching city info by key:', error);
      return null;
    }
  }

  private prioritizeResults(results: ReverseGeocodeResult[], limit: number): ReverseGeocodeResult[] {
    // スコアリングによる優先順位付け
    const scored = results.map(result => {
      const detailScore = this.getDetailScore(result.match_level);
      const distance = result.distance || 0;
      const score = detailScore * (1 / (1 + distance / 100));

      return { ...result, score };
    });

    // スコアの高い順にソート
    scored.sort((a, b) => (b.score || 0) - (a.score || 0));

    return scored.slice(0, limit);
  }

  private getDetailScore(matchLevel: MatchLevel): number {
    switch (matchLevel) {
      case MatchLevel.RESIDENTIAL_DETAIL: return 1.0;
      case MatchLevel.RESIDENTIAL_BLOCK: return 0.9;
      case MatchLevel.PARCEL: return 0.85;
      case MatchLevel.MACHIAZA: return 0.7;
      case MatchLevel.CITY: return 0.5;
      case MatchLevel.PREFECTURE: return 0.3;
      default: return 0.1;
    }
  }
}

// ワーカースレッドのエントリーポイント
if (!isMainThread && parentPort) {
  (async (parentPort: MessagePort) => {
    const reader = new Readable({
      objectMode: true,
      read() {},
    });

    const initData = workerData as ReverseGeocodeWorkerInitData;
    initData.debug = false;
    const reverseGeocodeTransform = await ReverseGeocodeTransform.create(initData);

    // メインスレッドからメッセージを受け取る
    parentPort.on('message', (task: string) => {
      const received = JSON.parse(task) as ThreadJob<ReverseGeocodeWorkerInput> | ThreadPing;

      switch (received.kind) {
        case 'ping': {
          parentPort.postMessage(JSON.stringify({
            kind: 'pong',
          }));
          return;
        }

        case 'task': {
          reader.push(received);
          return;
        }

        default:
          throw 'not implemented';
      }
    });

    // reverseGeocodeTransform からの出力をメインスレッドに送る
    const dst = new Writable({
      objectMode: true,
      write: (result: any, _, callback) => {
        parentPort.postMessage(JSON.stringify({
          taskId: result.taskId,
          data: result.results,
          kind: 'result',
        }));
        callback();
      },
    });

    reader.pipe(reverseGeocodeTransform).pipe(dst);
  })(parentPort);
}
