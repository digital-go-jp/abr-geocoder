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

  private constructor(
    private readonly workerPool: IWorkerThreadPool<AbrGeocoderInput, QueryJson>,
    private readonly geocodeDbController: GeocodeDbController,
    private readonly signal?: AbrAbortSignal,
  ) {
    this.signal?.addEventListener('abort', () => this.close());
  }

  private flushResults() {
    // 処理が完了しているタスクを、入力順に出力する
    if (this.flushing) {
      return;
    }
    this.flushing = true;
    while (this.taskHead && this.taskHead.isResolved) {
      // resolve or reject を実行する
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
    // resolver, rejector をキープする
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

    const limit = params.limit || 1;
    const adminResults = await this.searchFromAdmin(params.lat, params.lon, limit * 3);
    
    const searchResults = await this.getSearchResults(params, adminResults, limit);
    const prioritizedResults = this.prioritizeResults(searchResults, limit);
    
    const finalResults = prioritizedResults.slice(0, limit);
    
    // デバッグモードでは結果がない場合にログ出力
    if (finalResults.length === 0) {
      this.logError('reverseGeocode', 'no-results', 
        new Error(`No results found for coordinates: ${params.lat}, ${params.lon}`));
    }
    
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
        const residentialResults = await this.searchFromResidential(params.lat, params.lon, limit * 3);
        return [...residentialResults, ...adminResults];
      
      case SearchTarget.PARCEL:
        const parcelResults = await this.searchFromParcel(params.lat, params.lon, limit * 3);
        return [...parcelResults, ...adminResults];
      
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
    const residentialResults = await this.searchFromResidential(lat, lon, limit * 3);
    const parcelResults = await this.searchFromParcel(lat, lon, limit * 3);
    
    const allCandidates = [...residentialResults, ...parcelResults, ...adminResults];
    allCandidates.sort((a, b) => a.distance - b.distance);
    
    return allCandidates;
  }

  private prioritizeResults(candidates: ReverseGeocodeResult[], limit: number): ReverseGeocodeResult[] {
    const results: ReverseGeocodeResult[] = [];
    
    for (const candidate of candidates) {
      if (this.isDuplicate(candidate, results)) {
        continue;
      }
      
      if (this.shouldIncludeCandidate(candidate, candidates)) {
        results.push(candidate);
      }
      
      if (results.length >= limit) {
        break;
      }
    }
    
    results.sort((a, b) => a.distance - b.distance);
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
      const townSql = `
        SELECT 
          c.lg_code, c.city, c.county, c.ward, p.pref,
          t.machiaza_id, t.oaza_cho, t.chome, t.koaza, t.rep_lat, t.rep_lon, t.rsdt_addr_flg,
          (6371000 * acos(
            cos(radians(?)) * cos(radians(t.rep_lat)) * 
            cos(radians(t.rep_lon) - radians(?)) + 
            sin(radians(?)) * sin(radians(t.rep_lat))
          )) AS distance
        FROM town t
        JOIN city c ON t.city_key = c.city_key
        JOIN pref p ON c.pref_key = p.pref_key
        WHERE t.rep_lat IS NOT NULL AND t.rep_lon IS NOT NULL
        AND (6371000 * acos(
          cos(radians(?)) * cos(radians(t.rep_lat)) * 
          cos(radians(t.rep_lon) - radians(?)) + 
          sin(radians(?)) * sin(radians(t.rep_lat))
        )) < 5000
        ORDER BY distance
        LIMIT ?
      `;

      const townRows = (db as any).prepare(townSql).all(lat, lon, lat, lat, lon, lat, limit);
      for (const row of townRows) {
        const query = this.rowToQuery(row, 'town', row.lg_code);
        if (query) {
          results.push({
            ...query.toJSON(),
            distance: row.distance,
          } as any);
        }
      }

      // 市区町村レベル（10km範囲）- 町丁目で十分な結果が得られない場合
      if (results.length < limit) {
        const citySql = `
          SELECT 
            c.lg_code, c.city, c.county, c.ward, c.rep_lat, c.rep_lon, p.pref,
            (6371000 * acos(
              cos(radians(?)) * cos(radians(c.rep_lat)) * 
              cos(radians(c.rep_lon) - radians(?)) + 
              sin(radians(?)) * sin(radians(c.rep_lat))
            )) AS distance
          FROM city c
          JOIN pref p ON c.pref_key = p.pref_key
          WHERE c.rep_lat IS NOT NULL AND c.rep_lon IS NOT NULL
          AND (6371000 * acos(
            cos(radians(?)) * cos(radians(c.rep_lat)) * 
            cos(radians(c.rep_lon) - radians(?)) + 
            sin(radians(?)) * sin(radians(c.rep_lat))
          )) < 10000
          ORDER BY distance
          LIMIT ?
        `;

        const cityRows = (db as any).prepare(citySql).all(lat, lon, lat, lat, lon, lat, limit - results.length);
        for (const row of cityRows) {
          const query = this.rowToQuery(row, 'city', row.lg_code);
          if (query) {
            results.push({
              ...query.toJSON(),
              distance: row.distance,
            } as any);
          }
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
    const results: ReverseGeocodeResult[] = [];
    const lgCodes = await this.getLgCodesInRange(lat, lon);

    for (const lgCode of lgCodes) {
      try {
        const db = await this.geocodeDbController.openRsdtDspDb({ 
          lg_code: lgCode,
          createIfNotExists: false, 
        });
        
        if (!db) {
          continue;
        }

        const commonDb = await this.geocodeDbController.openCommonDb();
        const cityInfo = await this.getCityInfo(commonDb, lgCode);

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
          WHERE rd.rep_lat IS NOT NULL AND rd.rep_lon IS NOT NULL
          AND (6371000 * acos(
            cos(radians(?)) * cos(radians(rd.rep_lat)) * 
            cos(radians(rd.rep_lon) - radians(?)) + 
            sin(radians(?)) * sin(radians(rd.rep_lat))
          )) < 1000
          ORDER BY distance
          LIMIT ?
        `;

        const rows = (db as any).prepare(sql).all(lat, lon, lat, lat, lon, lat, limit);
        
        for (const row of rows) {
          // rsdt_blkのtown_keyを使用して町情報を取得
          let townInfo = null;
          if (row.town_key) {
            try {
              townInfo = (commonDb as any).prepare(`
                SELECT t.oaza_cho, t.chome, t.koaza, t.machiaza_id, t.rsdt_addr_flg
                FROM town t
                WHERE t.town_key = ?
                LIMIT 1
              `).get(row.town_key);
            } catch {
              // 町情報の取得に失敗した場合、町情報なしで継続
            }
          }
          
          const addressParts = [
            cityInfo?.pref,
            cityInfo?.city,
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

        await db.close();
        await commonDb.close();
        
        if (results.length >= limit) {
          break;
        }
      } catch (error) {
        this.logError('searchFromResidential', lgCode, error);
        // データベースエラーが発生した場合、該当LGコードをスキップして継続
        continue;
      }
    }

    return results;
  }

  private async searchFromParcel(lat: number, lon: number, limit: number): Promise<ReverseGeocodeResult[]> {
    const results: ReverseGeocodeResult[] = [];
    const lgCodes = await this.getLgCodesInRange(lat, lon);

    for (const lgCode of lgCodes) {
      try {
        const db = await this.geocodeDbController.openParcelDb({
          lg_code: lgCode,
          createIfNotExists: false,
        });
        
        if (!db) {
          continue;
        }

        const commonDb = await this.geocodeDbController.openCommonDb();
        const cityInfo = await this.getCityInfo(commonDb, lgCode);

        const sql = `
          SELECT 
            p.prc_num1, p.prc_num2, p.prc_num3, 
            p.prc_id, p.rep_lat, p.rep_lon,
            (6371000 * acos(
              cos(radians(?)) * cos(radians(p.rep_lat)) * 
              cos(radians(p.rep_lon) - radians(?)) + 
              sin(radians(?)) * sin(radians(p.rep_lat))
            )) AS distance
          FROM parcel p
          WHERE p.rep_lat IS NOT NULL AND p.rep_lon IS NOT NULL
          AND (6371000 * acos(
            cos(radians(?)) * cos(radians(p.rep_lat)) * 
            cos(radians(p.rep_lon) - radians(?)) + 
            sin(radians(?)) * sin(radians(p.rep_lat))
          )) < 5000
          ORDER BY distance
          LIMIT ?
        `;

        const rows = (db as any).prepare(sql).all(lat, lon, lat, lat, lon, lat, limit);
        
        for (const row of rows) {
          // 座標に基づく町情報を取得
          let townInfo = null;
          try {
            townInfo = (commonDb as any).prepare(`
              SELECT t.oaza_cho, t.chome, t.koaza, t.machiaza_id, t.rsdt_addr_flg
              FROM town t
              JOIN city c ON t.city_key = c.city_key
              WHERE c.lg_code = ?
              ORDER BY (6371000 * acos(
                cos(radians(?)) * cos(radians(t.rep_lat)) * 
                cos(radians(t.rep_lon) - radians(?)) + 
                sin(radians(?)) * sin(radians(t.rep_lat))
              ))
              LIMIT 1
            `).get(lgCode, row.rep_lat, row.rep_lon, row.rep_lat);
          } catch {
            // 町データが見つからない場合、町情報なしで継続
          }
          
          const formattedAddress = [
            cityInfo?.pref,
            cityInfo?.city,
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

        await db.close();
        await commonDb.close();
        
        if (results.length >= limit) {
          break;
        }
      } catch (error) {
        this.logError('searchFromParcel', lgCode, error);
        // データベースエラーが発生した場合、該当LGコードをスキップして継続
        continue;
      }
    }

    return results;
  }

  private async getLgCodesInRange(lat: number, lon: number): Promise<string[]> {
    const lgCodes: string[] = [];
    
    try {
      const db = await this.geocodeDbController.openCommonDb();
      
      const sql = `
        SELECT DISTINCT lg_code,
        (6371000 * acos(
          cos(radians(?)) * cos(radians(rep_lat)) * 
          cos(radians(rep_lon) - radians(?)) + 
          sin(radians(?)) * sin(radians(rep_lat))
        )) AS distance
        FROM city 
        WHERE rep_lat IS NOT NULL AND rep_lon IS NOT NULL
        AND (6371000 * acos(
          cos(radians(?)) * cos(radians(rep_lat)) * 
          cos(radians(rep_lon) - radians(?)) + 
          sin(radians(?)) * sin(radians(rep_lat))
        )) < 50000
        ORDER BY distance
        LIMIT 10
      `;

      const rows = (db as any).prepare(sql).all(lat, lon, lat, lat, lon, lat);
      for (const row of rows) {
        lgCodes.push(row.lg_code);
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
    return (commonDb as any).prepare(`
      SELECT c.city, c.county, c.ward, p.pref
      FROM city c 
      JOIN pref p ON c.pref_key = p.pref_key
      WHERE c.lg_code = ?
    `).get(lgCode);
  }

  private logError(methodName: string, lgCode: string, error: any): void {
    // AbrgErrorかどうかで出力レベルを調整
    if (error instanceof AbrgError) {
      switch (error.level) {
        case AbrgErrorLevel.ERROR:
          console.error(`[ReverseGeocode] Error in ${methodName} for LG code ${lgCode}:`, error.messageId);
          break;
        case AbrgErrorLevel.WARN:
          console.warn(`[ReverseGeocode] Warning in ${methodName} for LG code ${lgCode}:`, error.messageId);
          break;
        default:
          console.log(`[ReverseGeocode] Info in ${methodName} for LG code ${lgCode}:`, error.messageId);
      }
    } else {
      // 通常のエラー
      console.error(`[ReverseGeocode] Error in ${methodName} for LG code ${lgCode}:`, error?.message || error);
    }
  }
  
  async close() {
    await this.workerPool.close();
  }

  static create = async (params: {
    container: AbrGeocoderDiContainer;
    numOfThreads: number;
    signal?: AbrAbortSignal;
    isSilentMode: boolean;
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
