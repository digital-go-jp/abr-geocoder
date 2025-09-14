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
import { IWorkerThreadPool } from "@domain/services/thread/iworker-thread-pool";
import { toSharedMemory } from "@domain/services/thread/shared-memory";
import { WorkerThreadPool } from "@domain/services/thread/worker-thread-pool";
import { WorkerPoolTaskInfo } from "@domain/services/thread/worker-thread-pool-task-info";
import { GeocodeTransform } from '@usecases/geocode/worker/geocode-worker';
import path from 'node:path';
import { FakeWorkerThreadPool } from "./fake-worker-thread-pool";
import { AbrGeocoderDiContainer } from "./models/abr-geocoder-di-container";
import { AbrGeocoderInput } from "./models/abrg-input-data";
import { CityAndWardTrieFinder } from "./models/city-and-ward-trie-finder";
import { CountyAndCityTrieFinder } from "./models/county-and-city-trie-finder";
import { KyotoStreetTrieFinder } from "./models/kyoto-street-trie-finder";
import { OazaChoTrieFinder } from "./models/oaza-cho-trie-finder";
import { PrefTrieFinder } from "./models/pref-trie-finder";
import { Query, QueryJson } from "./models/query";
import { Tokyo23TownTrieFinder } from "./models/tokyo23-town-finder";
import { Tokyo23WardTrieFinder } from "./models/tokyo23-ward-trie-finder";
import { WardTrieFinder } from "./models/ward-trie-finder";
import { GeocodeWorkerInitData } from "./worker/geocode-worker-init-data";
import { AbrAbortSignal } from "@domain/models/abr-abort-controller";
import { PrefLgCode } from "@domain/types/pref-lg-code";
import { PrefInfo } from "@domain/types/geocode/pref-info";
import { SearchTarget } from "@domain/types/search-target";
import { MatchLevel } from "@domain/types/geocode/match-level";
import { GeocodeDbController } from "@drivers/database/geocode-db-controller";
import { AbrgError, AbrgErrorLevel } from "@domain/types/messages/abrg-error";
import { AbrgMessage } from "@domain/types/messages/abrg-message";
import fs from 'node:fs';

export type ReverseGeocodeParams = {
  lat: number;
  lon: number;
  limit?: number;
  searchTarget: SearchTarget;
  useSpatialIndex?: boolean; // true: R-tree使用, false: ハヴァーサイン公式使用
};

export interface ReverseGeocodeResult extends Query {
  distance: number;
}

/**
 * FormatterProvider互換オブジェクトの型定義
 */
export interface QueryCompatibleObject {
  [key: string]: any;
  match_level: {
    str: string;
    [key: string]: any;
  };
  coordinate_level: {
    str: string;
    [key: string]: any;
  };
  release: () => void;
}

export class AbrGeocoder {
  private taskHead: WorkerPoolTaskInfo<AbrGeocoderInput, Query> | undefined;
  private taskTail: WorkerPoolTaskInfo<AbrGeocoderInput, Query> | undefined;
  private readonly taskIDs: Set<number> = new Set();
  private flushing: boolean = false;
  private readonly defaultUseSpatialIndex: boolean = true; // デフォルトでR-tree使用

  private constructor(
    private readonly workerPool: IWorkerThreadPool<AbrGeocoderInput, QueryJson>,
    private readonly geocodeDbController: GeocodeDbController,
    private readonly signal?: AbrAbortSignal,
    useSpatialIndexDefault: boolean = true,
  ) {
    this.defaultUseSpatialIndex = useSpatialIndexDefault;
    this.signal?.addEventListener('abort', () => this.close());
  }

  private flushResults() {
    // 処理が完了しているタスクを、入力順に出力する
    if (this.flushing) {
      return;
    }
    this.flushing = true;
    while (this.taskHead && this.taskHead.isResolved) {
      // 成功または失敗時の処理を実行する
      this.taskHead.emit();
      const nextTask = this.taskHead.next;
      this.taskHead.next = undefined;
      this.taskHead = nextTask;
    }
    if (!this.taskHead) {
      this.taskTail = undefined;
    }
    this.flushing = false;
  }

  geocode(input: AbrGeocoderInput): Promise<Query> {

    let taskId = Math.floor(performance.now() + Math.random() * performance.now());
    while (this.taskIDs.has(taskId)) {
      taskId = Math.floor(performance.now() + Math.random() * performance.now());
    }
    // 成功・失敗時の処理をキープする
    const taskNode = new WorkerPoolTaskInfo<AbrGeocoderInput, Query>(input);
    this.taskIDs.add(taskId);

    // 順番を維持するために、連結リストで追加する
    if (this.taskHead) {
      this.taskTail!.next = taskNode;
      this.taskTail = taskNode;
    } else {
      this.taskHead = taskNode;
      this.taskTail = taskNode;
    }

    return new Promise<Query>((
      resolve: (result: Query) => void,
      reject: (error: Error) => void,
    ) => {
      taskNode.setResolver(resolve);
      taskNode.setRejector(reject);

      this.workerPool.run(input)
        .then((result: QueryJson) => {
          const query = Query.from(result);
          taskNode.setResult(null, query);
        })
        .catch((error: Error) => {
          taskNode.setResult(error);
        })
        .finally(() => {
          this.taskIDs.delete(taskId);
          this.flushResults();
        });
    });
  }

  async reverseGeocode(params: ReverseGeocodeParams): Promise<ReverseGeocodeResult[]> {
    // パラメータ検証
    if (isNaN(params.lat) || params.lat < -90 || params.lat > 90) {
      throw new AbrgError({
        messageId: AbrgMessage.REVERSE_GEOCODE_COORDINATE_INVALID,
        level: AbrgErrorLevel.ERROR,
      });
    }

    if (isNaN(params.lon) || params.lon < -180 || params.lon > 180) {
      throw new AbrgError({
        messageId: AbrgMessage.REVERSE_GEOCODE_COORDINATE_INVALID,
        level: AbrgErrorLevel.ERROR,
      });
    }

    // 手法選択: useSpatialIndexが指定されていない場合はデフォルト設定を使用
    const useSpatialIndex = params.useSpatialIndex ?? this.defaultUseSpatialIndex;

    if (useSpatialIndex) {
      // R-tree空間インデックス使用（高速版）
      return await this.reverseGeocodeWithSpatialIndex(params);
    } else {
      // ハヴァーサイン公式使用
      return await this.reverseGeocodeHaversine(params);
    }
  }

  /**
   * 空間インデックスによる逆ジオコーディング（高速版）
   */
  private async reverseGeocodeWithSpatialIndex(params: ReverseGeocodeParams): Promise<ReverseGeocodeResult[]> {
    const limit = params.limit || 1;
    
    // 空間インデックスが存在するか確認
    const hasSpatialIndex = await this.ensureSpatialIndexExists();
    if (!hasSpatialIndex) {
      // 空間インデックスが存在しない場合はハヴァーサイン公式にフォールバック
      return await this.reverseGeocodeHaversine(params);
    }
    
    const results: ReverseGeocodeResult[] = [];
    
    // Phase 1: 町丁目レベル（5km範囲）
    const townResults = await this.searchTownSpatial(params.lat, params.lon, 0.05, limit * 3);
    results.push(...townResults);
    
    // Phase 2: 市区町村レベル（10km範囲）- 町丁目で十分な結果が得られない場合
    if (results.length < limit) {
      const cityResults = await this.searchCitySpatial(params.lat, params.lon, 0.1, limit * 2);
      results.push(...cityResults);
    }
    
    // Phase 3: 住居表示・地番レベル（1km範囲）
    if (params.searchTarget === SearchTarget.ALL || params.searchTarget === SearchTarget.RESIDENTIAL || params.searchTarget === SearchTarget.PARCEL) {
      const detailResults = await this.searchResidentialParcelSpatial(params.lat, params.lon, results, limit);
      results.push(...detailResults);
    }
    
    // 重複除去と距離順ソート
    const uniqueResults = this.prioritizeResults(results, limit);
    return uniqueResults.slice(0, limit);
  }

  /**
   * ハヴァーサイン公式による逆ジオコーディング
   */
  private async reverseGeocodeHaversine(params: ReverseGeocodeParams): Promise<ReverseGeocodeResult[]> {
    const limit = params.limit || 1;
    const adminResults = await this.searchFromAdmin(params.lat, params.lon, limit * 3);
    
    const searchResults = await this.getSearchResults(params, adminResults, limit);
    const prioritizedResults = this.prioritizeResults(searchResults, limit);
    
    const finalResults = prioritizedResults.slice(0, limit);
    
    
    return finalResults;
  }

  private async getSearchResults(
    params: ReverseGeocodeParams, 
    adminResults: ReverseGeocodeResult[], 
    limit: number
  ): Promise<ReverseGeocodeResult[]> {
    switch (params.searchTarget) {
      case SearchTarget.ALL:
        return await this.getAllSearchResults(params.lat, params.lon, adminResults, limit);
      
      case SearchTarget.RESIDENTIAL:
        const residentialOnly = await this.searchFromResidential(params.lat, params.lon, limit);
        return [...adminResults, ...residentialOnly];
      
      case SearchTarget.PARCEL:
        const parcelOnly = await this.searchFromParcel(params.lat, params.lon, limit);
        return [...adminResults, ...parcelOnly];
      
      default:
        return adminResults;
    }
  }

  private async getAllSearchResults(
    lat: number, 
    lon: number, 
    adminResults: ReverseGeocodeResult[], 
    limit: number
  ): Promise<ReverseGeocodeResult[]> {
    // 住居表示・地番レベルの詳細検索を実行
    // 3つのLGコードに制限して性能を確保
    const results: ReverseGeocodeResult[] = [...adminResults];
    
    // 住居表示データの検索
    const residentialResults = await this.searchFromResidential(lat, lon, limit);
    results.push(...residentialResults);
    
    // 地番データの検索
    // 住居表示と地番の両方を検索して、最も近いものを選択できるようにする
    const parcelResults = await this.searchFromParcel(lat, lon, limit);
    results.push(...parcelResults);
    
    return results;
  }

  private prioritizeResults(candidates: ReverseGeocodeResult[], limit: number): ReverseGeocodeResult[] {
    const results: ReverseGeocodeResult[] = [];

    // 距離と詳細度でスコアリング
    const scoredCandidates = candidates.map(candidate => {
      // 詳細度によるスコア（高いほど詳細）
      let detailScore = 0;
      switch (candidate.match_level?.str) {
        case 'residential_detail':
          detailScore = 4;
          break;
        case 'parcel':
          detailScore = 3;
          break;
        case 'machiaza':
          detailScore = 2;
          break;
        case 'city':
        case 'ward':
          detailScore = 1;
          break;
        default:
          detailScore = 0;
      }

      // 距離ペナルティ（150m以内なら詳細度を優先、それ以上は距離を重視）
      const distancePenalty = candidate.distance < 150 ?
        candidate.distance * 0.001 :  // 150m以内: 軽いペナルティ
        candidate.distance < 300 ?
        candidate.distance * 0.003 :  // 150-300m: 中程度のペナルティ
        candidate.distance * 0.01;     // 300m以上: 重いペナルティ

      // 総合スコア（高いほど良い）
      const totalScore = detailScore - distancePenalty;

      return {
        candidate,
        score: totalScore,
        distance: candidate.distance
      };
    });

    // スコア順にソート（同点の場合は距離順）
    scoredCandidates.sort((a, b) => {
      if (Math.abs(a.score - b.score) < 0.01) {
        return a.distance - b.distance;
      }
      return b.score - a.score; // スコアは高い方が良い
    });

    // 重複除去しながら結果に追加
    for (const scored of scoredCandidates) {
      const candidate = scored.candidate;
      if (this.isDuplicate(candidate, results)) {
        continue;
      }
      results.push(candidate);
      if (results.length >= limit) {
        break;
      }
    }

    return results;
  }

  private isDuplicate(candidate: ReverseGeocodeResult, results: ReverseGeocodeResult[]): boolean {
    return results.some(r => 
      Math.abs(r.distance - candidate.distance) < 50 && 
      r.lg_code === candidate.lg_code
    );
  }

  private shouldIncludeCandidate(candidate: ReverseGeocodeResult, allCandidates: ReverseGeocodeResult[]): boolean {
    const isDetailedData = candidate.match_level?.str === 'residential_detail' || 
                           candidate.match_level?.str === 'parcel';
    
    if (isDetailedData) {
      return true;
    }
    
    const isAdminData = candidate.match_level?.str === 'machiaza' || 
                        candidate.match_level?.str === 'city';
    
    if (isAdminData) {
      return !this.hasNearbyDetailedData(candidate, allCandidates);
    }
    
    return false;
  }

  private hasNearbyDetailedData(candidate: ReverseGeocodeResult, allCandidates: ReverseGeocodeResult[]): boolean {
    return allCandidates.some(r => 
      (r.match_level?.str === 'residential_detail' || r.match_level?.str === 'parcel') &&
      Math.abs(r.distance - candidate.distance) < 200
    );
  }

  private async searchFromAdmin(lat: number, lon: number, limit: number): Promise<ReverseGeocodeResult[]> {
    const results: ReverseGeocodeResult[] = [];
    
    try {
      const db = await this.geocodeDbController.openCommonDb();

      // 町丁目レベル（5km範囲）
      const distanceSQL = this.getHaversineDistanceSQLWithColumns('t.rep_lat', 't.rep_lon');
      const townSql = `
        SELECT 
          c.lg_code, c.city, c.county, c.ward, p.pref,
          t.machiaza_id, t.oaza_cho, t.chome, t.koaza, t.rep_lat, t.rep_lon, t.rsdt_addr_flg,
          ${distanceSQL} AS distance
        FROM town t
        JOIN city c ON t.city_key = c.city_key
        JOIN pref p ON c.pref_key = p.pref_key
        WHERE t.rep_lat IS NOT NULL AND t.rep_lon IS NOT NULL
        AND ${distanceSQL} < 5000
        ORDER BY distance
        LIMIT ?
      `;

      const townRows = (db as any).prepare(townSql).all(lat, lon, lat, lat, lon, lat, limit);
      for (const row of townRows) {
        results.push(this.createQueryFromSpatialResult({
          ...row,
          match_level: MatchLevel.MACHIAZA,
        }, row.distance));
      }

      // 市区町村レベル（10km範囲）- 町丁目で十分な結果が得られない場合
      if (results.length < limit) {
        const cityDistanceSQL = this.getHaversineDistanceSQLWithColumns('c.rep_lat', 'c.rep_lon');
        const citySql = `
          SELECT 
            c.lg_code, c.city, c.county, c.ward, c.rep_lat, c.rep_lon, p.pref,
            ${cityDistanceSQL} AS distance
          FROM city c
          JOIN pref p ON c.pref_key = p.pref_key
          WHERE c.rep_lat IS NOT NULL AND c.rep_lon IS NOT NULL
          AND ${cityDistanceSQL} < 10000
          ORDER BY distance
          LIMIT ?
        `;

        const cityRows = (db as any).prepare(citySql).all(lat, lon, lat, lat, lon, lat, limit - results.length);
        for (const row of cityRows) {
          results.push(this.createQueryFromSpatialResult({
            ...row,
            match_level: MatchLevel.CITY,
          }, row.distance));
        }
      }

      await db.close();
    } catch (error) {
      // データベースアクセスエラーをログに記録し、空配列を返す
      this.logError('searchFromAdmin', 'all', error);
      // 管理情報の取得に失敗してもサービスを継続
    }

    return results;
  }

  private async searchFromResidential(lat: number, lon: number, limit: number): Promise<ReverseGeocodeResult[]> {
    return this.processLgCodeDatabases(lat, lon, limit, async (db, lgCode, lat, lon, limit) => {
      const results: ReverseGeocodeResult[] = [];
      const commonDb = await this.geocodeDbController.openCommonDb();
      const cityInfo = await this.getCityInfo(commonDb, lgCode);

      // rsdt_dspテーブルの存在確認
      const hasRsdtDsp = await this.checkTableExists(db, 'rsdt_dsp');

      if (hasRsdtDsp) {
        const distanceSQL = this.getHaversineDistanceSQLWithColumns('rd.rep_lat', 'rd.rep_lon');
      const sql = `
        SELECT 
          rd.rsdt_id, rd.rsdt2_id, rd.rsdt_num, rd.rsdt_num2, 
          rd.rep_lat, rd.rep_lon, rb.blk_id, rb.blk_num, rb.town_key,
          ${distanceSQL} AS distance
        FROM rsdt_dsp rd
        LEFT JOIN rsdt_blk rb ON rd.rsdtblk_key = rb.rsdtblk_key
        WHERE rd.rep_lat IS NOT NULL AND rd.rep_lon IS NOT NULL
        AND ${distanceSQL} < 1000
        ORDER BY distance
        LIMIT ?
      `;

      const rows = (db as any).prepare(sql).all(lat, lon, lat, lat, lon, lat, limit);

      for (const row of rows) {
        // rsdt_blkのtown_keyを使用して町情報を取得
        const townInfo = await this.getTownInfo(commonDb, row.town_key);
        
        const addressParts = [
          cityInfo?.pref,
          cityInfo?.county,
          cityInfo?.city,
          cityInfo?.ward,
          townInfo?.oaza_cho,
          townInfo?.chome,
        ].filter(Boolean);
        
        if (row.blk_num && row.rsdt_num) {
          addressParts.push(row.blk_num + '-' + row.rsdt_num);
        } else if (row.blk_num) {
          addressParts.push(row.blk_num);
        } else if (row.rsdt_num) {
          addressParts.push(row.rsdt_num);
        }
        
        const formattedAddress = addressParts.join('');

        results.push({
          input: { data: { address: '', searchTarget: 'residential' }, taskId: 0 },
          searchTarget: 'residential',
          lg_code: lgCode,
          rep_lat: row.rep_lat?.toString(),
          rep_lon: row.rep_lon?.toString(),
          pref: cityInfo?.pref || null,
          city: cityInfo?.city || null,
          county: cityInfo?.county || null,
          ward: cityInfo?.ward || null,
          oaza_cho: townInfo?.oaza_cho || null,
          chome: townInfo?.chome || null,
          koaza: townInfo?.koaza || null,
          block: row.blk_num || null,
          block_id: row.blk_id || null,
          rsdt_num: row.rsdt_num || null,
          rsdt_id: row.rsdt_id || null,
          rsdt_num2: row.rsdt_num2 || null,
          rsdt2_id: row.rsdt2_id || null,
          rsdt_addr_flg: townInfo?.rsdt_addr_flg ?? null,
          machiaza_id: townInfo?.machiaza_id || null,
          prc_num1: null,
          prc_num2: null,
          prc_num3: null,
          prc_id: null,
          match_level: { str: 'residential_detail' },
          formatted: { address: formattedAddress },
          unmatched: null,
          coordinate_level: null,
          matchedCnt: 1,
          ambiguousCnt: 0,
          fuzzy: null,
          other_detail: null,
          tempAddress: null,
          distance: row.distance,
        } as any);
      }
      }

      // rsdt_blkテーブルのみの場合（住居番号なし）
      const hasRsdtBlk = await this.checkTableExists(db, 'rsdt_blk');
      if (!hasRsdtDsp && hasRsdtBlk) {
        const distanceSQL = this.getHaversineDistanceSQLWithColumns('rb.rep_lat', 'rb.rep_lon');
        const sql = `
          SELECT
            rb.blk_id, rb.blk_num, rb.town_key, rb.rep_lat, rb.rep_lon,
            ${distanceSQL} AS distance
          FROM rsdt_blk rb
          WHERE rb.rep_lat IS NOT NULL AND rb.rep_lon IS NOT NULL
          AND ${distanceSQL} < 1000
          ORDER BY distance
          LIMIT ?
        `;

        const rows = (db as any).prepare(sql).all(lat, lon, lat, lat, lon, lat, limit);

        for (const row of rows) {
          const townInfo = await this.getTownInfo(commonDb, row.town_key);

          const formattedAddress = this.formatAddress({
            pref: cityInfo?.pref,
            county: cityInfo?.county,
            city: cityInfo?.city,
            ward: cityInfo?.ward,
            oaza_cho: townInfo?.oaza_cho,
            chome: townInfo?.chome,
            blk_num: row.blk_num
          });

          results.push({
            input: { data: { address: '' }, taskId: 0 },
            match_level: { str: 'residential_detail', num: 8 },
            coordinate_level: null,
            searchTarget: SearchTarget.RESIDENTIAL,
            lg_code: lgCode,
            machiaza_id: townInfo?.machiaza_id,
            rep_lat: row.rep_lat?.toString(),
            rep_lon: row.rep_lon?.toString(),
            block_id: row.blk_id,
            rsdt_addr_flg: townInfo?.rsdt_addr_flg,
            rsdt_id: null,
            rsdt2_id: null,
            prc_id: null,
            oaza_cho: townInfo?.oaza_cho,
            chome: townInfo?.chome,
            koaza: townInfo?.koaza,
            rsdt_num: null,
            rsdt_num2: null,
            prc_num1: null,
            prc_num2: null,
            prc_num3: null,
            formatted: { address: formattedAddress },
            unmatched: null,
            matchedCnt: 1,
            ambiguousCnt: 0,
            fuzzy: null,
            other_detail: null,
            tempAddress: null,
            distance: row.distance,
          } as any);
        }
      }

      await commonDb.close();
      return results;
    });
  }

  private async searchFromParcel(lat: number, lon: number, limit: number): Promise<ReverseGeocodeResult[]> {
    return this.processLgCodeDatabases(lat, lon, limit, async (db, lgCode, lat, lon, limit) => {
      const results: ReverseGeocodeResult[] = [];

      const commonDb = await this.geocodeDbController.openCommonDb();
      const cityInfo = await this.getCityInfo(commonDb, lgCode);

      const distanceSQL = this.getHaversineDistanceSQLWithColumns('p.rep_lat', 'p.rep_lon');
      const sql = `
        SELECT 
          p.prc_num1, p.prc_num2, p.prc_num3, 
          p.prc_id, p.rep_lat, p.rep_lon,
          ${distanceSQL} AS distance
        FROM parcel p
        WHERE p.rep_lat IS NOT NULL AND p.rep_lon IS NOT NULL
        AND ${distanceSQL} < 5000
        ORDER BY distance
        LIMIT ?
      `;

      const rows = (db as any).prepare(sql).all(lat, lon, lat, lat, lon, lat, limit);
      
      for (const row of rows) {
        // 座標に基づく町情報を取得
        const townInfo = await this.getNearestTownInfo(commonDb, lgCode, row.rep_lat, row.rep_lon);
        
        const formattedAddress = [
          cityInfo?.pref,
          cityInfo?.county,
          cityInfo?.city,
          cityInfo?.ward,
          townInfo?.oaza_cho,
          townInfo?.chome,
          [row.prc_num1, row.prc_num2, row.prc_num3].filter(Boolean).join('-')
        ].filter(Boolean).join('');

        results.push({
          input: { data: { address: '', searchTarget: 'parcel' }, taskId: 0 },
          searchTarget: 'parcel',
          lg_code: lgCode,
          rep_lat: row.rep_lat?.toString(),
          rep_lon: row.rep_lon?.toString(),
          pref: cityInfo?.pref || null,
          city: cityInfo?.city || null,
          county: cityInfo?.county || null,
          ward: cityInfo?.ward || null,
          oaza_cho: townInfo?.oaza_cho || null,
          chome: townInfo?.chome || null,
          koaza: townInfo?.koaza || null,
          block: null,
          block_id: null,
          rsdt_num: null,
          rsdt_id: null,
          rsdt_num2: null,
          rsdt2_id: null,
          rsdt_addr_flg: townInfo?.rsdt_addr_flg ?? null,
          machiaza_id: townInfo?.machiaza_id || null,
          prc_num1: row.prc_num1 || null,
          prc_num2: row.prc_num2 || null,
          prc_num3: row.prc_num3 || null,
          prc_id: row.prc_id || null,
          match_level: { str: 'parcel' },
          formatted: { address: formattedAddress },
          unmatched: null,
          coordinate_level: null,
          matchedCnt: 1,
          ambiguousCnt: 0,
          fuzzy: null,
          other_detail: null,
          tempAddress: null,
          distance: row.distance,
        } as any);
      }

      await commonDb.close();
      return results;
    });
  }

  private async getLgCodesInRange(lat: number, lon: number): Promise<string[]> {
    const lgCodes: string[] = [];
    const lgCodeSet = new Set<string>();

    try {
      const db = await this.geocodeDbController.openCommonDb();

      // Step 1: 最も近い町丁目を検索して、実際に属するLGコードを特定
      const townDistanceSQL = this.getHaversineDistanceSQLWithColumns('t.rep_lat', 't.rep_lon');
      const townSql = `
        SELECT DISTINCT c.lg_code, ${townDistanceSQL} AS distance
        FROM town t
        JOIN city c ON t.city_key = c.city_key
        WHERE t.rep_lat IS NOT NULL AND t.rep_lon IS NOT NULL
        AND ${townDistanceSQL} < 3000
        ORDER BY distance
        LIMIT 3
      `;

      const townRows = (db as any).prepare(townSql).all(lat, lon, lat, lat, lon, lat);

      // 最も近い町丁目のLGコードを最優先で追加
      for (const row of townRows) {
        if (!lgCodeSet.has(row.lg_code)) {
          lgCodes.push(row.lg_code);
          lgCodeSet.add(row.lg_code);
        }
      }

      // Step 2: 近隣の市区町村を追加（すでに追加されたものは除く）
      const cityDistanceSQL = this.getHaversineDistanceSQL();
      const citySql = `
        SELECT DISTINCT lg_code, ${cityDistanceSQL} AS distance
        FROM city
        WHERE rep_lat IS NOT NULL AND rep_lon IS NOT NULL
        AND ${cityDistanceSQL} < 50000
        ORDER BY distance
        LIMIT 10
      `;

      const cityRows = (db as any).prepare(citySql).all(lat, lon, lat, lat, lon, lat);
      for (const row of cityRows) {
        if (!lgCodeSet.has(row.lg_code) && lgCodes.length < 10) {
          lgCodes.push(row.lg_code);
          lgCodeSet.add(row.lg_code);
        }
      }

      await db.close();
    } catch (error) {
      this.logError('getLgCodesInRange', 'unknown', error);
    }

    return lgCodes;
  }

  private rowToQuery(row: any, sourceType: string, _lgCode: string): Query | null {
    try {
      let matchLevel: MatchLevel;
      switch (sourceType) {
        case 'residential':
          matchLevel = MatchLevel.RESIDENTIAL_DETAIL;
          break;
        case 'parcel':
          matchLevel = MatchLevel.PARCEL;
          break;
        case 'town':
          matchLevel = MatchLevel.MACHIAZA;
          break;
        case 'city':
          matchLevel = MatchLevel.CITY;
          break;
        default:
          matchLevel = MatchLevel.UNKNOWN;
      }

      // ダミーのQueryInputを作成
      const dummyInput = {
        data: {
          address: '',
          searchTarget: SearchTarget.ALL,
        },
        taskId: 0,
      };

      const query = Query.create(dummyInput);
      
      // データベースの行データでQueryを更新
      const updatedQuery = query.copy({
        lg_code: row.lg_code,
        machiaza_id: row.machiaza_id,
        rep_lat: row.rep_lat?.toString(),
        rep_lon: row.rep_lon?.toString(),
        rsdt_addr_flg: row.rsdt_addr_flg,
        pref: row.pref,
        oaza_cho: row.oaza_cho,
        chome: row.chome,
        koaza: row.koaza,
        block: row.blk_num,
        block_id: row.blk_id,
        rsdt_num: row.rsdt_num,
        rsdt_id: row.rsdt_id,
        rsdt_num2: row.rsdt_num2,
        rsdt2_id: row.rsdt2_id,
        prc_num1: row.prc_num1,
        prc_num2: row.prc_num2,
        prc_num3: row.prc_num3,
        prc_id: row.prc_id,
        city: row.city,
        county: row.county,
        ward: row.ward,
        match_level: matchLevel,
        coordinate_level: matchLevel,
      });

      return updatedQuery;
    } catch (_error) {
      return null;
    }
  }

  /**
   * ReverseGeocodeResultをFormatterProvider互換のQuery形式に変換
   */
  public convertReverseResultToQueryCompatible(result: ReverseGeocodeResult): QueryCompatibleObject {
    const baseObject = result;
    const matchLevelStr = this.getMatchLevelString(baseObject.match_level);
    
    return {
      ...baseObject,
      // フォーマッターが期待する必須フィールドを追加
      unmatched: [],  // 逆ジオコーディングでは未マッチ部分はない
      others: [],     // 逆ジオコーディングではその他の候補はない
      tempAddress: null,  // 一時住所オブジェクトはない
      match_level: {
        ...baseObject.match_level,
        str: matchLevelStr
      },
      coordinate_level: {
        ...baseObject.coordinate_level,
        str: matchLevelStr
      },
      release: () => {
        // プレーンオブジェクトなので解放処理不要
      }
    };
  }

  /**
   * MatchLevelオブジェクトから文字列表現を取得
   */
  private getMatchLevelString(matchLevel: any): string {
    if (matchLevel?.str) {
      return matchLevel.str;
    }
    
    if (!matchLevel?.num) {
      return 'unknown';
    }
    
    // MatchLevel.numの値をマッピング
    const levelMap: Record<number, string> = {
      [MatchLevel.RESIDENTIAL_DETAIL.num]: 'residential_detail',
      [MatchLevel.RESIDENTIAL_BLOCK.num]: 'residential_block', 
      [MatchLevel.MACHIAZA_DETAIL.num]: 'machiaza_detail',
      [MatchLevel.MACHIAZA.num]: 'machiaza',
      [MatchLevel.CITY.num]: 'city',
      [MatchLevel.PREFECTURE.num]: 'prefecture',
      [MatchLevel.PARCEL.num]: 'parcel',
      [MatchLevel.ERROR.num]: 'error',
      [MatchLevel.UNKNOWN.num]: 'unknown'
    };
    
    return levelMap[matchLevel.num] || 'unknown';
  }

  private static readonly DEFAULT_DB_VERSION = "20240501";

  async getDbVersion(): Promise<string> {
    try {
      // データセットキャッシュの最新更新日時からバージョンを取得
      const connectParams = this.geocodeDbController.connectParams;
      
      if (connectParams.type === 'sqlite3') {
        const datasetDbPath = path.join(connectParams.dataDir, 'dataset.sqlite');
        
        if (fs.existsSync(datasetDbPath)) {
          const BetterSqlite3 = await import('better-sqlite3');
          const db = new BetterSqlite3.default(datasetDbPath, { readonly: true });
          
          try {
            const stmt = db.prepare('SELECT MAX(last_modified) as latest_date FROM dataset');
            const result = stmt.get() as { latest_date?: string } | undefined;
            
            if (result?.latest_date) {
              // "Wed, 28 May 2025 13:53:40 GMT" 形式の日付文字列をパース
              const date = new Date(result.latest_date);
              
              if (!isNaN(date.getTime())) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                
                return `${year}${month}${day}`;
              }
            }
          } finally {
            db.close();
          }
        }
      }
    } catch (error) {
      // エラー時は既定バージョンにフォールバック（静黙）
    }
    
    return AbrGeocoder.DEFAULT_DB_VERSION;
  }

  private async getCityInfo(commonDb: any, lgCode: string) {
    return this.getCityInfoFromCommonDb(commonDb, lgCode);
  }

  /**
   * ハヴァーサイン距離計算のSQLフラグメントを生成
   */
  private getHaversineDistanceSQL(): string {
    return `(6371000 * acos(
      cos(radians(?)) * cos(radians(rep_lat)) * 
      cos(radians(rep_lon) - radians(?)) + 
      sin(radians(?)) * sin(radians(rep_lat))
    ))`;
  }

  /**
   * ハヴァーサイン距離計算のSQLフラグメントを生成（特定カラム指定版）
   */
  private getHaversineDistanceSQLWithColumns(latCol: string, lonCol: string): string {
    return `(6371000 * acos(
      cos(radians(?)) * cos(radians(${latCol})) * 
      cos(radians(${lonCol}) - radians(?)) + 
      sin(radians(?)) * sin(radians(${latCol}))
    ))`;
  }

  /**
   * データベーステーブルの存在をチェック
   */
  private async checkTableExists(db: any, tableName: string): Promise<boolean> {
    const result = (db as any).prepare(
      `SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name=?`
    ).get(tableName);
    return result.cnt > 0;
  }

  /**
   * 市区町村情報を取得する共通メソッド
   */
  private async getCityInfoFromCommonDb(commonDb: any, lgCode: string) {
    return (commonDb as any).prepare(`
      SELECT c.lg_code, c.city, c.county, c.ward, p.pref
      FROM city c 
      JOIN pref p ON c.pref_key = p.pref_key
      WHERE c.lg_code = ?
    `).get(lgCode);
  }

  /**
   * 町丁目情報を取得する共通メソッド
   */
  private async getTownInfo(commonDb: any, townKey: string | null) {
    if (!townKey) return null;
    try {
      return (commonDb as any).prepare(`
        SELECT t.town_key, t.machiaza_id, t.oaza_cho, t.chome, t.koaza, t.rsdt_addr_flg
        FROM town t
        WHERE t.town_key = ?
        LIMIT 1
      `).get(townKey);
    } catch {
      return null;
    }
  }

  /**
   * 座標に基づいて最寄りの町丁目情報を取得
   */
  private async getNearestTownInfo(commonDb: any, lgCode: string, lat: number, lon: number) {
    try {
      const distanceSQL = this.getHaversineDistanceSQLWithColumns('t.rep_lat', 't.rep_lon');
      return (commonDb as any).prepare(`
        SELECT t.oaza_cho, t.chome, t.koaza, t.machiaza_id, t.rsdt_addr_flg
        FROM town t
        JOIN city c ON t.city_key = c.city_key
        WHERE c.lg_code = ?
        ORDER BY ${distanceSQL}
        LIMIT 1
      `).get(lgCode, lat, lon, lat);
    } catch {
      return null;
    }
  }

  private logError(methodName: string, lgCode: string, error: any): void {
    // エラーログ出力は無効（JSON出力を壊さないため）
    return;
  }
  
  async close() {
    await this.workerPool.close();
  }

  static create = async (params: {
    container: AbrGeocoderDiContainer;
    numOfThreads: number;
    signal?: AbrAbortSignal;
    isSilentMode: boolean;
    useSpatialIndex?: boolean;
  }) => {
    const db = await params.container.database.openCommonDb();
    const prefList: PrefInfo[] = await db.getPrefList();

    const geocodeDbController = new GeocodeDbController({ 
      connectParams: params.container.database.connectParams, 
    });

    // トライ木を作成するために必要な辞書データの読み込み
    const pref = toSharedMemory((await PrefTrieFinder.loadDataFile({
      diContainer: params.container,
      data: {
        type: "pref",
      },
    }))!);
    const countyAndCity = toSharedMemory((await CountyAndCityTrieFinder.loadDataFile({
      diContainer: params.container,
      data: {
        type: "county-and-city",
      },
    }))!);
    const cityAndWard = toSharedMemory((await CityAndWardTrieFinder.loadDataFile({
      diContainer: params.container,
      data:  {
        type: "city-and-ward",
      },
    }))!);
    const kyotoStreet = toSharedMemory((await KyotoStreetTrieFinder.loadDataFile({
      diContainer: params.container,
      data:  {
        type: "kyoto-street",
      },
    }))!);

    const oazaChomes = [];
    for await (const prefInfo of prefList) {
      oazaChomes.push({
        lg_code: prefInfo.lg_code as PrefLgCode,
        data: toSharedMemory((await OazaChoTrieFinder.loadDataFile({
          diContainer: params.container,
          data:  {
            type: "oaza-cho",
            lg_code: prefInfo.lg_code as PrefLgCode,
          },
        }))!),
      });
    }

    const ward = toSharedMemory((await WardTrieFinder.loadDataFile({
      diContainer: params.container,
      data: {
        type:  "ward",
      },
    }))!);
    const tokyo23Ward = toSharedMemory((await Tokyo23WardTrieFinder.loadDataFile({
      diContainer: params.container,
      data:  {
        type: "tokyo23-ward",
      },
    }))!);
    const tokyo23Town = toSharedMemory((await Tokyo23TownTrieFinder.loadDataFile({
      diContainer: params.container,
      data:  {
        type: "tokyo23-town",
      },
    }))!);

    const initData: GeocodeWorkerInitData = {
      diContainer: params.container.toJSON(),
      trieData: {
        pref,
        countyAndCity,
        cityAndWard,
        kyotoStreet,
        oazaChomes,
        ward,
        tokyo23Ward,
        tokyo23Town,
      },
      debug: false,
    };

    // スレッド数が2未満、もしくは、jest で動かしている場合は、メインスレッドで処理する
    if (params.numOfThreads < 2 || process.env.JEST_WORKER_ID !== undefined) {
      const geocodeTransform = await GeocodeTransform.create(initData);
      const fakePool = new FakeWorkerThreadPool(geocodeTransform);

      return new AbrGeocoder(
        fakePool,
        geocodeDbController,
        params.signal,
        params.useSpatialIndex ?? true,
      );
    }

    const workerPool = await WorkerThreadPool.create<GeocodeWorkerInitData, AbrGeocoderInput, QueryJson>({
      // 最大何スレッド生成するか
      maxConcurrency: Math.max(1, params.numOfThreads),

      // 1スレッドあたり、いくつのタスクを同時並行させるか
      // (ストリームのバックプレッシャに影響するので、固定値にしておく)
      maxTasksPerWorker: 500,

      // geocode-worker.ts へのパス
      filename: path.join(__dirname, 'worker', 'geocode-worker'),

      // geocode-worker.ts の初期化に必要なデータ
      initData,

      signal: params.signal,
    });
    
    return new AbrGeocoder(
      workerPool,
      geocodeDbController,
      params.signal,
    );
  };

}
