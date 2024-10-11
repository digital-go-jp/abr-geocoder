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
      let maybeIncorrect = false;
      let target = (() => {
        const addr = trimDashAndSpace(query.tempAddress)?.
          // 「1丁目下る」の「丁目」を省略して書く事がある
          replaceAll(RegExpEx.create(`([0-9]+)(?:丁目|${DASH})(上る|下る)`, 'g'), `$1$2`);

        if (!query.oaza_cho) {
          return addr;
        }
        // 既に大字が判明している場合、大字を付加する。
        // trie tree には「（大字)(通り名)」で格納しているため
        // 大字を付けないとヒットしない
        maybeIncorrect = true;
        return CharNode.create(query.oaza_cho!)?.concat(addr);
      })();
        
      if (!target) {
        results.add(query);
        continue;
      }
      
      // 京都の通り名の場合、(通り名)+(大字)の構成になっている。
      // 重要なのは(大字)だけ。
      // 通り名が間違えていると大字に当たらないので、1文字ずつ場所を変えながら探す

      let anyHit = false;
      const unmatched: string[] = [];

      while (!anyHit && target) {
        const findResults = this.trie.find({
          target,
          fuzzy: DEFAULT_FUZZY_CHAR,
        });
        if (!findResults || findResults.length === 0) {
          // 1文字右に移動して、再度検索する
          unmatched.push(target.originalChar!);
          target = target.next;
          continue;
        }

        // 複数にヒットする可能性がある
        findResults.forEach(findResult => {
          if (!findResult.info) {
            throw new Error('findResult.info is empty');
          }

          const koaza = (() => {
            // 当たらなかった部分はおそらく通り名
            if (unmatched.length > 0) {
              return unmatched.join('');
            }
            return findResult.info.koaza;
          })();

          // 小字(通り名)がヒットした
          const params: Record<string, CharNode | number | string | MatchLevel> = {
            tempAddress: findResult.unmatched,
            match_level: MatchLevel.MACHIAZA_DETAIL,
            town_key: findResult.info.town_key,
            city_key: findResult.info.city_key,
            rsdt_addr_flg: findResult.info.rsdt_addr_flg,
            oaza_cho: findResult.info.oaza_cho,
            chome: findResult.info.chome,
            koaza,
            koaza_aka_code: 2,
            machiaza_id: findResult.info.machiaza_id,
            matchedCnt: query.matchedCnt + findResult.depth,
            ambiguousCnt: query.ambiguousCnt + (findResult.ambiguous ? 1 : 0) + (maybeIncorrect ? 1 : 0),
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
      }

      if (!anyHit || maybeIncorrect) {
        results.add(query);
      }
    }

    callback(null, results);
  }

}
