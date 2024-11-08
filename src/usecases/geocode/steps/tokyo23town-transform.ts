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
import { CharNode } from "@usecases/geocode/models/trie/char-node";
import { Transform, TransformCallback } from 'node:stream';
import { QuerySet } from '../models/query-set';
import { Tokyo23TownTrieFinder } from '../models/tokyo23-town-finder';
import { toHankakuAlphaNum } from '../services/to-hankaku-alpha-num';
import { trimDashAndSpace } from '../services/trim-dash-and-space';

export class Tokyo23TownTranform extends Transform {
  
  constructor(
    private readonly tokyo23TownTrie: Tokyo23TownTrieFinder,
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
      const target = trimDashAndSpace(query.tempAddress);
        
      // 行政区が判明している場合はスキップ
      if (!target || 
        query.match_level.num >= MatchLevel.CITY.num) {
        results.add(query);
        continue;
      }

      // 東京都〇〇区〇〇パターンを探索する
      const searchResults = this.tokyo23TownTrie.find({
        target,
        extraChallenges: ['区', '町', '市', '村'],
        partialMatches: true,
        fuzzy: DEFAULT_FUZZY_CHAR,
      });
      if (!searchResults || searchResults.length === 0) {
        results.add(query);
        continue;
      }

      // 東京都〇〇区〇〇にヒットした
      let anyHit = false;
      let anyAmbiguous = false;
      searchResults.forEach(searchResult => {
        if (!searchResult.info) {
          throw new Error('searchResult.info is empty');
        }
        anyAmbiguous = anyAmbiguous || searchResult.ambiguous;
        anyHit = true;

        const params: Record<string, CharNode | number | string | MatchLevel | undefined | null> = {
          pref_key: searchResult.info.pref_key,
          city_key: searchResult.info.city_key,
          town_key: searchResult.info.town_key,
          rsdt_addr_flg: searchResult.info.rsdt_addr_flg,
          tempAddress: searchResult.unmatched,
          matchedCnt: query.matchedCnt + searchResult.depth,
          koaza: toHankakuAlphaNum(searchResult.info.koaza),
          pref: searchResult.info.pref,
          county: searchResult.info.county,
          city: searchResult.info.city,
          ward: searchResult.info.ward,
          lg_code: searchResult.info.lg_code,
          oaza_cho: searchResult.info.oaza_cho,
          machiaza_id: searchResult.info.machiaza_id,
          chome: searchResult.info.chome,
          ambiguousCnt: query.ambiguousCnt + (searchResult.ambiguous ? 1 : 0), 
        };
        if (searchResult.info.machiaza_id.endsWith('000')) {
          params.match_level = MatchLevel.MACHIAZA;
        } else {
          params.match_level = MatchLevel.MACHIAZA_DETAIL;
        }

        if (searchResult.info.rep_lat && searchResult.info.rep_lon) {
          params.rep_lat = searchResult.info.rep_lat;
          params.rep_lon = searchResult.info.rep_lon;
          params.coordinate_level = params.match_level;
        }
        results.add(query.copy(params));
      });
      if (!anyHit || anyAmbiguous) {
        results.add(query);
      }
    }
    callback(null, results);
  }
}
