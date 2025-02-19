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
import { PrefTrieFinder } from '../models/pref-trie-finder';
import { QuerySet } from '../models/query-set';
import { trimDashAndSpace } from '../services/trim-dash-and-space';

export class PrefTransform extends Transform {

  constructor(
    private readonly prefTrie: PrefTrieFinder,
  ) {
    super({
      objectMode: true,
    });
  }

  async _transform(
    queries: QuerySet,
    _: BufferEncoding,
    next: TransformCallback,
  ) {
    const results = new QuerySet();
    for (const query of queries.values()) {
      const target = trimDashAndSpace(query.tempAddress);
      if (!target) {
        results.add(query);
        continue;
      }
      // --------------------
      // 都道府県を探索する
      // --------------------
      const matched = this.prefTrie.find({
        target,

        // マッチしなかったときに、unmatchAttemptsに入っている文字列を試す。
        extraChallenges: ['道', '都', '府', '県'],
        
        fuzzy: DEFAULT_FUZZY_CHAR,
      });

      if (!matched || matched?.length === 0) {
        results.add(query);
        break;
      }
      let anyHit = false;
      let anyAmbiguous = false;
      for (const mResult of matched) {
        if (!mResult.info) {
          continue;
        }
        anyAmbiguous = anyAmbiguous || mResult.ambiguousCnt > 0;
        anyHit = true;
        results.add(query.copy({
          pref_key: mResult.info.pref_key,
          tempAddress: mResult.unmatched,
          rep_lat: mResult.info.rep_lat,
          rep_lon: mResult.info.rep_lon,
          lg_code: mResult.info.lg_code,
          pref: mResult.info.pref,
          match_level: MatchLevel.PREFECTURE,
          coordinate_level: MatchLevel.PREFECTURE,
          matchedCnt: mResult.depth,
          ambiguousCnt: query.ambiguousCnt + mResult.ambiguousCnt, 
        }));
      }
      if (!anyHit || anyAmbiguous) {
        results.add(query);
      }
    }

    queries.clear();

    next(null, results);
  }
}
