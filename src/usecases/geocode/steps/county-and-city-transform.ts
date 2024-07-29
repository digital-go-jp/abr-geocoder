/*!
 * MIT License
 *
 * Copyright (c) 2023 デジタル庁
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
import { Transform, TransformCallback } from 'node:stream';
import { toHiragana } from '../services/to-hiragana';
import { Query } from '../models/query';
import { jisKanji } from '../services/jis-kanji';
import { kan2num } from '../services/kan2num';
import { TrieAddressFinder } from '../services/trie/trie-finder';
import { CityMatchingInfo } from '@domain/types/geocode/city-info';
import { MatchLevel } from '@domain/types/geocode/match-level';
import { DebugLogger } from '@domain/services/logger/debug-logger';
import timers from 'node:timers/promises';

export class CountyAndCityTransform extends Transform {

  private readonly countyAndCityTrie: TrieAddressFinder<CityMatchingInfo>;
  private readonly logger: DebugLogger | undefined;
  private initialized: boolean = false;

  constructor(params: Required<{
    countyAndCityList: CityMatchingInfo[];
    logger: DebugLogger | undefined;
  }>) {
    super({
      objectMode: true,
    });
    this.logger = params.logger;
    
    // 〇〇郡〇〇市町村のトライ木
    this.countyAndCityTrie = new TrieAddressFinder();
    setImmediate(() => {
      for (const city of params.countyAndCityList) {
        this.countyAndCityTrie.append({
          key: this.normalizeStr(city.key),
          value: city,
        });
      }
      this.initialized = true;
    })
  }

  async _transform(
    queries: Query[],
    _: BufferEncoding,
    next: TransformCallback
  ) {
    await new Promise(async (resolve: (_?: unknown[]) => void) => {
      while (!this.initialized) {
        await timers.setTimeout(100);
      }
      resolve();
    });

    const results = queries
      .map(query => {
        if (!query.tempAddress) {
          return query;
        }
        // 既に判明している場合はスキップ
        if (query.match_level.num >= MatchLevel.CITY.num) {
          return query;
        }
        // -------------------------
        // 〇〇郡〇〇市町村を探索する
        // -------------------------
        const results = this.countyAndCityTrie.find({
          target: query.tempAddress,
          extraChallenges: ['郡', '市', '町', '村'],
          partialMatches: true,
          fuzzy: query.fuzzy,
        });
        if (!results || results.length === 0) {
          return query;
        }
        return results
          // 都道府県が判別していない、または判別できでいて、result.pref_key が同一のもの
          // (伊達市のように同じ市町村名でも異なる都道府県の場合がある)
          .filter(result => {
            return (query.match_level.num === MatchLevel.UNKNOWN.num || 
              query.match_level.num === MatchLevel.PREFECTURE.num &&
              query.pref_key === result.info?.pref_key
            );
          })
          .map(result => {
            // 誤マッチングの可能性もあるので、元々のqueryも残しておく
            return [query, query.copy({
              pref: query.pref || result.info!.pref,
              pref_key: query.pref_key || result.info!.pref_key,
              city_key: result.info!.city_key,
              tempAddress: result.unmatched,
              city: result.info!.city,
              county: result.info!.county,
              ward: result.info!.ward,
              rep_lat: result.info!.rep_lat,
              rep_lon: result.info!.rep_lon,
              lg_code: result.info!.lg_code,
              match_level: MatchLevel.CITY,
              coordinate_level: MatchLevel.CITY,
              matchedCnt: query.matchedCnt + result.depth,
            })];
          })
          .flat();
      })
      .flat();
    
    const seen = new Set<string | undefined>();
    const filteredReslts = results.filter(x => {
      const tempAddress = x.tempAddress?.toString();
      if (seen.has(tempAddress)) {
        return false;
      }
      seen.add(tempAddress);
      return true;
    });
    this.logger?.info(`county-and-city : ${((Date.now() - filteredReslts[0].startTime) / 1000).toFixed(2)} s`);
    next(null, filteredReslts);
  }

  private normalizeStr(value: string): string {
    // 半角カナ・全角カナ => 平仮名
    value = toHiragana(value);

    // JIS 第2水準 => 第1水準 及び 旧字体 => 新字体
    value = jisKanji(value);

    // 漢数字 => 算用数字
    value = kan2num(value);

    return value;
  }
}
