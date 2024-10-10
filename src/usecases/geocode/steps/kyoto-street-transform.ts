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
import { DASH, DEFAULT_FUZZY_CHAR } from '@config/constant-values';
import { MatchLevel } from '@domain/types/geocode/match-level';
import { PrefLgCode } from '@domain/types/pref-lg-code';
import { CharNode } from "@usecases/geocode/models/trie/char-node";
import { Transform, TransformCallback } from 'node:stream';
import { KyotoStreetTrieFinder } from '../models/kyoto-street-trie-finder';
import { QuerySet } from '../models/query-set';
import { trimDashAndSpace } from '../services/trim-dash-and-space';
import { RegExpEx } from '@domain/services/reg-exp-ex';

export class KyotoStreetTransform extends Transform {

  constructor(
    private readonly trie: KyotoStreetTrieFinder,
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
    // ------------------------
    // 通り名・大字で当たるものがあるか
    // ------------------------
    const results = new QuerySet();
    const KYOTO_PREF_LG_CODE = PrefLgCode.KYOTO.substring(0, 2);
    for await (const query of queries.values()) {
      if (query.match_level.num > MatchLevel.MACHIAZA.num) {
        // 大字以降が既に判明しているものはスキップ
        results.add(query);
        continue;
      }

      if (query.match_level.num === MatchLevel.CITY.num &&
          query.lg_code?.substring(0, 2) !== KYOTO_PREF_LG_CODE) {
        // 京都府以外の場合はスキップ
        results.add(query);
        continue;
      }

      if (!query.tempAddress) {
        // 探索する文字がなければスキップ
        results.add(query);
        continue;
      }
      
      // ------------------------------------
      // トライ木を使って探索
      // ------------------------------------
      
      
      const target = trimDashAndSpace(query.tempAddress)?.
        // 「1丁目下る」の「丁目」を省略して書く事がある
        replaceAll(RegExpEx.create(`([0-9]+)(?:丁目|${DASH})(上る|下る)`, 'g'), `$1$2`);
      if (!target) {
        results.add(query);
        continue;
      }
      
      let anyHit = false;
      const findResults = this.trie.find({
        target,
        fuzzy: DEFAULT_FUZZY_CHAR,
      });

      // 複数にヒットする可能性がある
      findResults?.forEach(findResult => {
        if (!findResult.info) {
          throw new Error('findResult.info is empty');
        }

        // 小字(通り名)がヒットした
        const params: Record<string, CharNode | number | string | MatchLevel> = {
          tempAddress: findResult.unmatched,
          match_level: MatchLevel.MACHIAZA_DETAIL,
          town_key: findResult.info.town_key,
          city_key: findResult.info.city_key,
          rsdt_addr_flg: findResult.info.rsdt_addr_flg,
          oaza_cho: findResult.info.oaza_cho,
          chome: findResult.info.chome,
          koaza: findResult.info.koaza,
          koaza_aka_code: 2,
          machiaza_id: findResult.info.machiaza_id,
          matchedCnt: query.matchedCnt + findResult.depth, 
        };
        if (findResult.info.rep_lat && findResult.info.rep_lon) {
          params.coordinate_level = MatchLevel.MACHIAZA_DETAIL;
          params.rep_lat = findResult.info.rep_lat;
          params.rep_lon = findResult.info.rep_lon;
        }
        const copied = query.copy(params);
        results.add(copied);

        anyHit = true;
      });

      if (!anyHit) {
        results.add(query);
      }
    }

    callback(null, results);
  }

}
