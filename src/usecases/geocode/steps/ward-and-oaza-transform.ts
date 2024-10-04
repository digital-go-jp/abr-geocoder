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
import { AMBIGUOUS_RSDT_ADDR_FLG, DEFAULT_FUZZY_CHAR } from '@config/constant-values';
import { MatchLevel } from '@domain/types/geocode/match-level';
import { OazaChoMachingInfo } from '@domain/types/geocode/oaza-cho-info';
import { TrieAddressFinder } from "@usecases/geocode/models/trie/trie-finder";
import { Transform, TransformCallback } from 'node:stream';
import { QuerySet } from '../models/query-set';
import { trimDashAndSpace } from '../services/trim-dash-and-space';
import { WardAndOazaTrieFinder } from '../models/ward-and-oaza-trie-finder';

export class WardAndOazaTransform extends Transform {

  constructor(
    private readonly wardAndOazaTrie: WardAndOazaTrieFinder,
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
      if (!query.tempAddress) {
        results.add(query);
        continue;
      }
      // 既に判明している場合はスキップ
      if (query.match_level.num >= MatchLevel.CITY.num) {
        results.add(query);
        continue;
      }

      // -------------------------
      // 〇〇市町村を探索する
      // -------------------------
      const target = trimDashAndSpace(query.tempAddress);
      if (!target) {
        results.add(query);
        continue;
      }
      const trieResults = this.wardAndOazaTrie.find({
        target,
        extraChallenges: ['市', '町', '村'],
        partialMatches: true,
        fuzzy: DEFAULT_FUZZY_CHAR,
      });
      if (!trieResults || trieResults.length === 0) {
        results.add(query);
        continue;
      }

      let anyAmbiguous = false;
      let anyHit = false;

      for (const mResult of trieResults) {
        // 都道府県が判別していない、または判別できでいて、
        // result.pref_key が同一でない結果はスキップする
        // (伊達市のように同じ市町村名でも異なる都道府県の場合がある)
        if (query.match_level.num === MatchLevel.PREFECTURE.num && 
          query.pref_key !== mResult.info?.pref_key) {
          continue;
        }
        anyAmbiguous = anyAmbiguous || mResult.ambiguous;
        anyHit = true;

        results.add(query.copy({
          pref: query.pref || mResult.info!.pref,
          pref_key: query.pref_key || mResult.info!.pref_key,
          city_key: mResult.info!.city_key,
          tempAddress: mResult.unmatched,
          city: mResult.info!.city,
          county: mResult.info!.county,
          lg_code: mResult.info!.lg_code,
          ward: mResult.info!.ward,
          rep_lat: mResult.info!.rep_lat,
          rep_lon: mResult.info!.rep_lon,
          machiaza_id: mResult.info!.machiaza_id,

          // 大字・小字に rsdt_addr_flg で 0,1 が混在する可能性があるので
          // この時点では不明。なので AMBIGUOUS_RSDT_ADDR_FLG
          rsdt_addr_flg: AMBIGUOUS_RSDT_ADDR_FLG,
          oaza_cho: mResult.info!.oaza_cho,
          match_level: MatchLevel.MACHIAZA,
          coordinate_level: MatchLevel.CITY,
          matchedCnt: query.matchedCnt + mResult.depth,
          ambiguousCnt: query.ambiguousCnt + (mResult.ambiguous ? 1 : 0), 
        }));
      }

      if (!anyHit || anyAmbiguous) {
        results.add(query);
      }
    }
    next(null, results);
  }
}
