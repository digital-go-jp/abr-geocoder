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
      params.useSpatialIndex ?? true,
    );
  };

  /**
   * 空間インデックスが存在するかチェックし、なければ作成
   */
  private async ensureSpatialIndexExists(): Promise<boolean> {
    try {
      const db = await this.geocodeDbController.openCommonDb();
      if (!db) return false;

      // town_spatialテーブルの存在確認
      const townSpatialExists = (db as any).prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='town_spatial'"
      ).get();

      const citySpatialExists = (db as any).prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='city_spatial'"
      ).get();

      if (townSpatialExists && citySpatialExists) {
        return true; // 既に存在
      }

      console.log('空間インデックスを作成しています...');

      // SQLite R*Tree Moduleを使用した空間インデックステーブル作成（町丁目用）
      if (!townSpatialExists) {
        (db as any).exec(`
          CREATE VIRTUAL TABLE IF NOT EXISTS town_spatial USING rtree(
            id INTEGER PRIMARY KEY,
            min_lat REAL,
            max_lat REAL,
            min_lon REAL,
            max_lon REAL
          );
          
          DELETE FROM town_spatial;
          
          INSERT INTO town_spatial (id, min_lat, max_lat, min_lon, max_lon)
          SELECT 
            rowid,
            rep_lat as min_lat,
            rep_lat as max_lat, 
            rep_lon as min_lon,
            rep_lon as max_lon
          FROM town 
          WHERE rep_lat IS NOT NULL AND rep_lon IS NOT NULL;
        `);
      }

      // SQLite R*Tree Moduleを使用した空間インデックステーブル作成（市区町村用）
      if (!citySpatialExists) {
        (db as any).exec(`
          CREATE VIRTUAL TABLE IF NOT EXISTS city_spatial USING rtree(
            id INTEGER PRIMARY KEY,
            min_lat REAL,
            max_lat REAL,
            min_lon REAL,
            max_lon REAL
          );
          
          DELETE FROM city_spatial;
          
          INSERT INTO city_spatial (id, min_lat, max_lat, min_lon, max_lon)
          SELECT 
            rowid,
            rep_lat,
            rep_lat,
            rep_lon,
            rep_lon
          FROM city 
          WHERE rep_lat IS NOT NULL AND rep_lon IS NOT NULL;
        `);
      }

      // インデックス統計更新
      (db as any).exec(`
        CREATE INDEX IF NOT EXISTS idx_town_coordinates ON town(rep_lat, rep_lon);
        CREATE INDEX IF NOT EXISTS idx_city_coordinates ON city(rep_lat, rep_lon);
        ANALYZE town_spatial;
        ANALYZE city_spatial; 
        ANALYZE town;
        ANALYZE city;
      `);

      const townCount = (db as any).prepare("SELECT COUNT(*) as count FROM town_spatial").get().count;
      const cityCount = (db as any).prepare("SELECT COUNT(*) as count FROM city_spatial").get().count;

      console.log(`空間インデックス作成完了: 町丁目${townCount}件, 市区町村${cityCount}件`);
      return true;

    } catch (error) {
      console.error('空間インデックス作成エラー:', error);
      return false;
    }
  }


  /**
   * 空間検索結果をQueryオブジェクトに変換
   */
  private createQueryFromSpatialResult(row: any, distance: number): ReverseGeocodeResult {
    // 住所文字列を生成
    const addressParts = [];
    
    // 都道府県を取得（lg_codeから判定）
    const prefCode = row.lg_code ? row.lg_code.substring(0, 2) : null;
    const prefName = this.getPrefNameFromCode(prefCode);
    if (prefName) addressParts.push(prefName);
    
    // 市区町村名を取得
    if (row.county) addressParts.push(row.county);
    if (row.city) addressParts.push(row.city);
    if (row.ward) addressParts.push(row.ward);
    
    // 町丁目
    if (row.oaza_cho) {
      addressParts.push(row.oaza_cho);
      if (row.chome) addressParts.push(row.chome);
      // koazaは、oaza_choが存在する場合のみ追加（小字として扱う）
      if (row.koaza) addressParts.push(row.koaza);
    }
    
    // 番地情報
    if (row.block && row.rsdt_num) {
      addressParts.push(`${row.block}-${row.rsdt_num}`);
      if (row.rsdt_num2) addressParts.push(`-${row.rsdt_num2}`);
    } else if (row.block) {
      addressParts.push(row.block);
    } else if (row.rsdt_num) {
      addressParts.push(row.rsdt_num.toString());
      if (row.rsdt_num2) addressParts.push(`-${row.rsdt_num2}`);
    }
    if (row.prc_num1) addressParts.push(row.prc_num1);
    if (row.prc_num2) addressParts.push(`-${row.prc_num2}`);
    
    const formattedAddress = addressParts.filter(Boolean).join('');
    
    // ベースとなるQueryを作成（逆ジオコーディングなのでaddressは空）
    const baseQuery = Query.create({
      data: {
        address: '',
        searchTarget: SearchTarget.ALL,
      },
      taskId: 0,
    });
    
    // 必要なフィールドをコピーして新しいQueryを作成
    const query = baseQuery.copy({
      searchTarget: SearchTarget.ALL,
      pref: prefName,
      pref_key: row.pref_key,
      county: row.county,
      city: row.city,
      city_key: row.city_key,
      ward: row.ward,
      lg_code: row.lg_code,
      oaza_cho: row.oaza_cho,
      chome: row.chome,
      koaza: row.koaza,
      town_key: row.town_key,
      machiaza_id: row.machiaza_id,
      rsdt_addr_flg: row.rsdt_addr_flg,
      block: row.block,
      block_id: row.block_id,
      rsdt_num: row.rsdt_num,
      rsdt_id: row.rsdt_id,
      rsdt_num2: row.rsdt_num2,
      rsdt2_id: row.rsdt2_id,
      prc_num1: row.prc_num1,
      prc_num2: row.prc_num2,
      prc_id: row.prc_id,
      rep_lat: row.rep_lat?.toString(),
      rep_lon: row.rep_lon?.toString(),
      match_level: row.match_level || MatchLevel.UNKNOWN,
      coordinate_level: row.match_level || MatchLevel.UNKNOWN,
      matchedCnt: formattedAddress.length,
      ambiguousCnt: 0,
    });
    
    // ReverseGeocodeResultを返す（QueryをインターフェースとしてDistanceを追加）
    const result: ReverseGeocodeResult = Object.assign(query, { distance });
    return result;
  }

  /**
   * 都道府県コードから都道府県名を取得
   */
  private getPrefNameFromCode(prefCode: string | null): string | undefined {
    if (!prefCode) return undefined;
    const prefMap: { [key: string]: string } = {
      '01': '北海道', '02': '青森県', '03': '岩手県', '04': '宮城県', '05': '秋田県',
      '06': '山形県', '07': '福島県', '08': '茨城県', '09': '栃木県', '10': '群馬県',
      '11': '埼玉県', '12': '千葉県', '13': '東京都', '14': '神奈川県', '15': '新潟県',
      '16': '富山県', '17': '石川県', '18': '福井県', '19': '山梨県', '20': '長野県',
      '21': '岐阜県', '22': '静岡県', '23': '愛知県', '24': '三重県', '25': '滋賀県',
      '26': '京都府', '27': '大阪府', '28': '兵庫県', '29': '奈良県', '30': '和歌山県',
      '31': '鳥取県', '32': '島根県', '33': '岡山県', '34': '広島県', '35': '山口県',
      '36': '徳島県', '37': '香川県', '38': '愛媛県', '39': '高知県', '40': '福岡県',
      '41': '佐賀県', '42': '長崎県', '43': '熊本県', '44': '大分県', '45': '宮崎県',
      '46': '鹿児島県', '47': '沖縄県',
    };
    return prefMap[prefCode];
  }

  /**
   * 町丁目データの空間検索（R-tree使用）
   */
  private async searchTownSpatial(lat: number, lon: number, radius: number, limit: number): Promise<ReverseGeocodeResult[]> {
    const db = await this.geocodeDbController.openCommonDb();
    if (!db) return [];

    const distanceSQL = this.getHaversineDistanceSQLWithColumns('t.rep_lat', 't.rep_lon');
    const sql = `
      SELECT 
        c.lg_code,
        c.county,
        c.city,
        c.ward,
        c.city_key,
        t.town_key,
        t.machiaza_id,
        t.oaza_cho,
        t.chome,
        t.koaza,
        t.rep_lat,
        t.rep_lon,
        t.rsdt_addr_flg,
        ${distanceSQL} AS distance
      FROM town t
      JOIN city c ON t.city_key = c.city_key
      JOIN town_spatial ts ON t.rowid = ts.id
      WHERE ts.min_lat BETWEEN ? - ? AND ? + ?
        AND ts.min_lon BETWEEN ? - ? AND ? + ?
        AND t.oaza_cho IS NOT NULL AND t.oaza_cho != ''  -- oaza_choがnullまたは空文字のレコードは除外
        AND ${distanceSQL} < 5000
      ORDER BY distance
      LIMIT ?
    `;

    const rows = (db as any).prepare(sql).all(
      lat, lon, lat,           // 距離計算
      lat, radius, lat, radius, // 緯度範囲  
      lon, radius, lon, radius, // 経度範囲
      lat, lon, lat,           // 距離フィルター
      limit
    );

    const results = rows.map((row: any) => {
      return this.createQueryFromSpatialResult({
        ...row,
        match_level: MatchLevel.MACHIAZA,
      }, row.distance);
    });
    return results;
  }

  /**
   * 市区町村データの空間検索
   */
  private async searchCitySpatial(lat: number, lon: number, radius: number, limit: number): Promise<ReverseGeocodeResult[]> {
    const db = await this.geocodeDbController.openCommonDb();
    if (!db) return [];

    const distanceSQL = this.getHaversineDistanceSQLWithColumns('c.rep_lat', 'c.rep_lon');
    const sql = `
      SELECT 
        c.lg_code,
        c.county,
        c.city,
        c.ward,
        c.city_key,
        c.rep_lat,
        c.rep_lon,
        ${distanceSQL} AS distance
      FROM city c
      JOIN city_spatial cs ON c.rowid = cs.id
      WHERE cs.min_lat BETWEEN ? - ? AND ? + ?
        AND cs.min_lon BETWEEN ? - ? AND ? + ?
        AND ${distanceSQL} < 10000
      ORDER BY distance
      LIMIT ?
    `;

    const rows = (db as any).prepare(sql).all(
      lat, lon, lat,
      lat, radius, lat, radius,
      lon, radius, lon, radius,
      lat, lon, lat,
      limit
    );

    return rows.map((row: any) => this.createQueryFromSpatialResult({
      ...row,
      match_level: MatchLevel.CITY,
    }, row.distance));
  }

  /**
   * 住居表示・地番データの検索（空間インデックス使用）
   */
  private async searchResidentialParcelSpatial(
    lat: number,
    lon: number,
    existingResults: ReverseGeocodeResult[],
    limit: number
  ): Promise<ReverseGeocodeResult[]> {
    const searchLimit = Math.max(limit, 5); // 最低5件は検索する
    const results: ReverseGeocodeResult[] = [];

    // 既存の結果からLGコードを抽出（すでに町丁目検索で特定済み）
    const lgCodesSet = new Set<string>();
    for (const result of existingResults) {
      if (result.lg_code) {
        lgCodesSet.add(result.lg_code);
      }
    }

    // LGコードが見つからない場合は空配列を返す
    if (lgCodesSet.size === 0) {
      return [];
    }

    const lgCodes = Array.from(lgCodesSet).slice(0, 5); // 最大5つのLGコードを使用

    try {
      // 住居表示データの空間検索（LGコードを直接渡す）
      const residentialResults = await this.searchResidentialSpatialWithLgCodes(lat, lon, lgCodes, 0.01, searchLimit);
      results.push(...residentialResults);

      // 地番データの空間検索（LGコードを直接渡す）
      if (results.length < searchLimit) {
        const parcelResults = await this.searchParcelSpatialWithLgCodes(lat, lon, lgCodes, 0.01, searchLimit);
        results.push(...parcelResults);
      }

      return results;
    } catch (error) {
      console.error('詳細空間検索エラー:', error);
      return [];
    }
  }

  /**
   * 住居表示データの空間検索（R-tree使用）
   */
  private async searchResidentialSpatial(lat: number, lon: number, radius: number, limit: number): Promise<ReverseGeocodeResult[]> {
    // 近隣のLGコードを取得
    const lgCodes = await this.getLgCodesInRange(lat, lon);
    return await this.searchResidentialSpatialWithLgCodes(lat, lon, lgCodes, radius, limit);
  }

  /**
   * 住居表示データの空間検索（LGコード指定版）
   */
  private async searchResidentialSpatialWithLgCodes(
    lat: number,
    lon: number,
    lgCodes: string[],
    radius: number,
    limit: number
  ): Promise<ReverseGeocodeResult[]> {
    if (lgCodes.length === 0) return [];

    const results: ReverseGeocodeResult[] = [];

    for (const lgCode of lgCodes) {
      const db = await this.geocodeDbController.openParcelDb({
        lg_code: lgCode,
        createIfNotExists: false,
      });
      if (!db) continue;
      
      try {
        // rsdt_blkテーブルの存在確認
        const hasRsdtBlk = await this.checkTableExists(db, 'rsdt_blk');
        if (!hasRsdtBlk) continue;
        
        // 住居表示空間検索を実行
        const residentialRows = await this.searchResidentialSpatialByLgCode(
          db, lgCode, lat, lon, radius, limit
        );
        
        for (const row of residentialRows) {
          results.push(row);
        }
      } catch (error) {
        console.error(`LGコード ${lgCode} の住居表示空間検索エラー:`, error);
      }
      
      if (results.length >= limit) break;
    }
    
    return results.slice(0, limit);
  }

  /**
   * 特定のLGコードDBでの住居表示空間検索
   */
  private async searchResidentialSpatialByLgCode(
    db: any, 
    lgCode: string, 
    lat: number, 
    lon: number, 
    radius: number, 
    limit: number
  ): Promise<ReverseGeocodeResult[]> {
    const results: ReverseGeocodeResult[] = [];
    
    // rsdt_dsp_spatialの存在確認（より詳細な住居番号レベル）
    const hasRsdtDspSpatial = await this.checkTableExists(db, 'rsdt_dsp_spatial');
    
    if (hasRsdtDspSpatial) {
      // rsdt_dsp空間インデックスを使用した検索（住居番号レベル）
      const distanceSQL = this.getHaversineDistanceSQLWithColumns('rd.rep_lat', 'rd.rep_lon');
      const sql = `
        SELECT 
          rd.rsdt_id, rd.rsdt2_id, rd.rsdt_num, rd.rsdt_num2,
          rd.rep_lat, rd.rep_lon, rb.blk_id, rb.blk_num, rb.town_key,
          ${distanceSQL} AS distance
        FROM rsdt_dsp rd
        LEFT JOIN rsdt_blk rb ON rd.rsdtblk_key = rb.rsdtblk_key
        JOIN rsdt_dsp_spatial rds ON rd.rowid = rds.id
        WHERE rds.min_lat BETWEEN ? - ? AND ? + ?
          AND rds.min_lon BETWEEN ? - ? AND ? + ?
          AND ${distanceSQL} < 1000
        ORDER BY distance
        LIMIT ?
      `;
      
      const rows = (db as any).prepare(sql).all(
        lat, lon, lat,           // 距離計算
        lat, radius, lat, radius, // 緯度範囲  
        lon, radius, lon, radius, // 経度範囲
        lat, lon, lat,           // 距離フィルター
        limit
      );
      
      await this.processResidentialRows(rows, lgCode, results, {
        rsdt_num: true,
        rsdt_id: true,
        rsdt_num2: true,
        rsdt2_id: true,
        blk_num: true,
        blk_id: true,
      });
    } else {
      // rsdt_dsp_spatialがない場合は、rsdt_blk_spatialを使用
      const hasRsdtBlkSpatial = await this.checkTableExists(db, 'rsdt_blk_spatial');
      
      if (hasRsdtBlkSpatial) {
        const distanceSQL = this.getHaversineDistanceSQLWithColumns('r.rep_lat', 'r.rep_lon');
        const sql = `
          SELECT 
            r.rsdtblk_key,
            r.town_key,
            r.blk_id,
            r.blk_num,
            r.rep_lat,
            r.rep_lon,
            ${distanceSQL} AS distance
          FROM rsdt_blk r
          JOIN rsdt_blk_spatial rs ON r.rowid = rs.id
          WHERE rs.min_lat BETWEEN ? - ? AND ? + ?
            AND rs.min_lon BETWEEN ? - ? AND ? + ?
            AND ${distanceSQL} < 1000
          ORDER BY distance
          LIMIT ?
        `;
        
        const rows = (db as any).prepare(sql).all(
          lat, lon, lat,           // 距離計算
          lat, radius, lat, radius, // 緯度範囲  
          lon, radius, lon, radius, // 経度範囲
          lat, lon, lat,           // 距離フィルター
          limit
        );
        
        await this.processResidentialRows(rows, lgCode, results, {
          blk_num: true,
          blk_id: true,
        });
      }
    }
    
    return results;
  }

  /**
   * 住居表示検索結果の行を処理して結果配列に追加
   */
  private async processResidentialRows(
    rows: any[], 
    lgCode: string, 
    results: ReverseGeocodeResult[], 
    fieldMap: { [key: string]: boolean }
  ): Promise<void> {
    for (const row of rows) {
      // 市区町村情報と町丁目情報を取得
      const commonDb = await this.geocodeDbController.openCommonDb();
      const cityInfo = await this.getCityInfoFromCommonDb(commonDb, lgCode);
      
      // 町丁目情報を取得
      const townInfo = await this.getTownInfo(commonDb, row.town_key);
      
      const resultData: any = {
        ...row,
        ...cityInfo,
        ...townInfo,
        match_level: MatchLevel.RESIDENTIAL_DETAIL,
      };
      
      // フィールドマップに基づいて結果データを設定
      if (fieldMap.blk_num) resultData.block = row.blk_num;
      if (fieldMap.blk_id) resultData.block_id = row.blk_id;
      if (fieldMap.rsdt_num) resultData.rsdt_num = row.rsdt_num;
      if (fieldMap.rsdt_id) resultData.rsdt_id = row.rsdt_id;
      if (fieldMap.rsdt_num2) resultData.rsdt_num2 = row.rsdt_num2;
      if (fieldMap.rsdt2_id) resultData.rsdt2_id = row.rsdt2_id;
      
      results.push(this.createQueryFromSpatialResult(resultData, row.distance));
      await commonDb.close();
    }
  }

  /**
   * 地番データの空間検索（R-tree使用）
   */
  private async searchParcelSpatial(lat: number, lon: number, radius: number, limit: number): Promise<ReverseGeocodeResult[]> {
    // 近隣のLGコードを取得
    const lgCodes = await this.getLgCodesInRange(lat, lon);
    return await this.searchParcelSpatialWithLgCodes(lat, lon, lgCodes, radius, limit);
  }

  /**
   * 地番データの空間検索（LGコード指定版）
   */
  private async searchParcelSpatialWithLgCodes(
    lat: number,
    lon: number,
    lgCodes: string[],
    radius: number,
    limit: number
  ): Promise<ReverseGeocodeResult[]> {
    if (lgCodes.length === 0) return [];

    const results: ReverseGeocodeResult[] = [];
    
    for (const lgCode of lgCodes) {
      const db = await this.geocodeDbController.openParcelDb({
        lg_code: lgCode,
        createIfNotExists: false,
      });
      if (!db) continue;
      
      try {
        // parcelテーブルの存在確認
        const hasParcel = await this.checkTableExists(db, 'parcel');
        if (!hasParcel) continue;
        
        // parcel_spatialの存在確認
        const hasSpatialIndex = await this.checkTableExists(db, 'parcel_spatial');
        
        if (hasSpatialIndex) {
          // 地番空間検索を実行
          const parcelRows = await this.searchParcelSpatialByLgCode(
            db, lgCode, lat, lon, radius, limit
          );
          
          for (const row of parcelRows) {
            results.push(row);
          }
        }
      } catch (error) {
        console.error(`LGコード ${lgCode} の地番空間検索エラー:`, error);
      }
      
      if (results.length >= limit) break;
    }
    
    return results.slice(0, limit);
  }

  /**
   * LGコード別DBでの共通処理を実行するヘルパーメソッド
   */
  private async processLgCodeDatabases<T>(
    lat: number,
    lon: number,
    limit: number,
    processor: (db: any, lgCode: string, lat: number, lon: number, limit: number) => Promise<T[]>
  ): Promise<T[]> {
    const lgCodes = await this.getLgCodesInRange(lat, lon);
    const limitedLgCodes = lgCodes.slice(0, 3); // 最も近い3つのLGコードのみ処理
    const allResults: T[] = [];

    // すべてのLGコードから結果を収集（limitを超えても全部取得）
    for (const lgCode of limitedLgCodes) {
      try {
        const db = await this.geocodeDbController.openParcelDb({
          lg_code: lgCode,
          createIfNotExists: false,
        });

        if (!db) {
          continue;
        }

        // 各LGコードからlimit * 2の結果を取得（後でソートするため）
        const lgResults = await processor(db, lgCode, lat, lon, limit * 2);
        allResults.push(...lgResults);

        await db.close();
      } catch (error) {
        this.logError('processLgCodeDatabases', lgCode, error);
        continue;
      }
    }

    // 全結果を距離順にソートしてからlimit分返す
    // TypeScriptの型システム上、distanceプロパティがあることを前提とする
    const sortedResults = allResults.sort((a: any, b: any) => {
      if (a.distance !== undefined && b.distance !== undefined) {
        return a.distance - b.distance;
      }
      return 0;
    });

    return sortedResults.slice(0, limit);
  }

  /**
   * 住所パーツを結合してフォーマット済み住所を作成
   */
  private formatAddress(parts: {
    pref?: string;
    county?: string;
    city?: string;
    ward?: string;
    oaza_cho?: string;
    chome?: string;
    koaza?: string;
    blk_num?: string;
    rsdt_num?: string;
    prc_nums?: string;
  }): string {
    const addressParts = [
      parts.pref,
      parts.county,
      parts.city,
      parts.ward,
      parts.oaza_cho,
      parts.chome,
      parts.koaza
    ].filter(Boolean);

    // 住居表示番号がある場合
    if (parts.rsdt_num && parts.blk_num) {
      addressParts.push(parts.blk_num + '-' + parts.rsdt_num);
    } else if (parts.blk_num) {
      addressParts.push(parts.blk_num);
    } else if (parts.rsdt_num) {
      addressParts.push(parts.rsdt_num);
    }

    // 地番番号がある場合
    if (parts.prc_nums) {
      addressParts.push(parts.prc_nums);
    }

    return addressParts.join('');
  }

  /**
   * 特定のLGコードDBでの地番空間検索
   */
  private async searchParcelSpatialByLgCode(
    db: any, 
    lgCode: string, 
    lat: number, 
    lon: number, 
    radius: number, 
    limit: number
  ): Promise<ReverseGeocodeResult[]> {
    const results: ReverseGeocodeResult[] = [];
    
    // 空間インデックスを使用した検索
    const distanceSQL = this.getHaversineDistanceSQLWithColumns('p.rep_lat', 'p.rep_lon');
    const sql = `
      SELECT 
        p.parcel_key,
        p.town_key,
        p.prc_id,
        p.prc_num1,
        p.prc_num2,
        p.prc_num3,
        p.rep_lat,
        p.rep_lon,
        ${distanceSQL} AS distance
      FROM parcel p
      JOIN parcel_spatial ps ON p.rowid = ps.id
      WHERE ps.min_lat BETWEEN ? - ? AND ? + ?
        AND ps.min_lon BETWEEN ? - ? AND ? + ?
        AND ${distanceSQL} < 1000
      ORDER BY distance
      LIMIT ?
    `;
    
    const rows = (db as any).prepare(sql).all(
      lat, lon, lat,           // 距離計算
      lat, radius, lat, radius, // 緯度範囲  
      lon, radius, lon, radius, // 経度範囲
      lat, lon, lat,           // 距離フィルター
      limit
    );
    
    for (const row of rows) {
      // 市区町村情報と町丁目情報を取得
      const commonDb = await this.geocodeDbController.openCommonDb();
      const cityInfo = await this.getCityInfoFromCommonDb(commonDb, lgCode);
      
      // 町丁目情報を取得
      const townInfo = await this.getTownInfo(commonDb, row.town_key);
      
      results.push(this.createQueryFromSpatialResult({
        ...row,
        ...cityInfo,
        ...townInfo,
        prc_id: row.prc_id,
        prc_num1: row.prc_num1,
        prc_num2: row.prc_num2,
        prc_num3: row.prc_num3,
        match_level: MatchLevel.PARCEL,
      }, row.distance));
      
      await commonDb.close();
    }
    
    return results;
  }

}
