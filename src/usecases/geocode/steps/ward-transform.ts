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
import { Transform, TransformCallback } from 'node:stream';
import { QuerySet } from '../models/query-set';
import { WardTrieFinder } from '../models/ward-trie-finder';
import { trimDashAndSpace } from '../services/trim-dash-and-space';

export class WardTransform extends Transform {

  constructor(
    private readonly wardTrie: WardTrieFinder,
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

      const target = trimDashAndSpace(query.tempAddress);
      if (!target) {
        results.add(query);
        continue;
      }

      const matched = this.wardTrie.find({
        target,
        extraChallenges: ['市', '区'],
        fuzzy: DEFAULT_FUZZY_CHAR,
        partialMatches: true,
      });

      if (!matched || matched.length === 0) {
        results.add(query);
        continue;
      }
      let anyAmbiguous = false;
      let anyHit = false;
      for (const mResult of matched) {
        if (query.pref_key && query.pref_key !== mResult.info?.pref_key) {
          continue;
        }
        anyAmbiguous = anyAmbiguous || mResult.ambiguousCnt > 0;
        anyHit = true;

        results.add(query.copy({
          pref_key: mResult.info!.pref_key,
          city_key: mResult.info!.city_key,
          pref: mResult.info!.pref,
          city: mResult.info!.city,
          lg_code: mResult.info!.lg_code,
          county: mResult.info!.county,
          ward: mResult.info!.ward,
          tempAddress: mResult.unmatched,
          match_level: MatchLevel.CITY,
          matchedCnt: query.matchedCnt + mResult.depth,
          rep_lat: mResult.info!.rep_lat,
          rep_lon: mResult.info!.rep_lon,
          coordinate_level: MatchLevel.CITY,
          ambiguousCnt: query.ambiguousCnt + mResult.ambiguousCnt, 
        }));
      }

      // 〇〇区で始まるパターンの場合、誤マッチングの可能性があるので
      // マッチしなかった可能性もキープしておく
      if (!anyHit || anyAmbiguous || query.match_level === MatchLevel.UNKNOWN) {
        results.add(query);
      }
    }

    queries.clear();

    callback(null, results);
  }
}
