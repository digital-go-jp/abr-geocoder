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
import { DEFAULT_FUZZY_CHAR } from '@config/constant-values';
import { MatchLevel } from '@domain/types/geocode/match-level';
import { PrefLgCode } from '@domain/types/pref-lg-code';
import { Transform, TransformCallback } from 'node:stream';
import { QuerySet } from '../models/query-set';
import { Tokyo23WardTrieFinder } from '../models/tokyo23-ward-trie-finder';
import { trimDashAndSpace } from '../services/trim-dash-and-space';

export class Tokyo23WardTranform extends Transform {

  private readonly needsCopy = new Set([
    '北区',
    '中央区',
    '港区',
    '大田区',
    '板橋区',
  ]);
  
  constructor(
    private readonly tokyo23WardTrie: Tokyo23WardTrieFinder,
  ) {
    super({
      objectMode: true,
    });
  }

  async _transform(
    queries: QuerySet,
    _: BufferEncoding,
    callback: TransformCallback,
  ) {
    const results = new QuerySet();
    for (const query of queries.values()) {
      // 行政区が判明している場合はスキップ
      if (!query.tempAddress || 
        query.match_level.num >= MatchLevel.CITY.num) {
        results.add(query);
        continue;
      }

      // 東京都〇〇区〇〇パターンを探索する
      const target = trimDashAndSpace(query.tempAddress);
      if (!target) {
        results.add(query);
        continue;
      }
      const searchResults = this.tokyo23WardTrie.find({
        target,
        extraChallenges: ['区'],
        partialMatches: true,
        fuzzy: DEFAULT_FUZZY_CHAR,
      });
      if (!searchResults || searchResults.length === 0) {
        results.add(query);
        continue;
      }

      let anyAmbiguous = false;
      let anyHit = false;
      searchResults.forEach(searchResult => {
        if (!searchResult.info) {
          throw new Error('searchResult.info is empty');
        }
        
        // 同じ区名で他都道府県に存在するので、
        // この時点で東京都と判定できていない場合は、
        // 他都道府県の可能性もあるので、ヒットしない場合もキープしておく
        if (query.lg_code !== PrefLgCode.TOKYO && this.needsCopy.has(searchResult.info.city)) {
          anyAmbiguous = true;
        }
        anyAmbiguous = anyAmbiguous || searchResult.ambiguous;
        anyHit = true;

        results.add(query.copy({
          pref_key: searchResult.info.pref_key,
          city_key: searchResult.info.city_key,
          tempAddress: searchResult.unmatched,
          match_level: MatchLevel.CITY,
          matchedCnt: query.matchedCnt + searchResult.depth,
          pref: searchResult.info.pref,
          city: searchResult.info.city,
          lg_code: searchResult.info.lg_code,
          rep_lat: searchResult.info.rep_lat,
          rep_lon: searchResult.info.rep_lon,
          coordinate_level: MatchLevel.CITY,
          ambiguousCnt: query.ambiguousCnt + (searchResult.ambiguous ? 1 : 0), 
        }));
      });
      if (!anyHit || anyAmbiguous) {
        results.add(query);
      }
    }

    callback(null, results);
  }
}
