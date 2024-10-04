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
import { WardMatchingInfo } from '@domain/types/geocode/ward-info';
import { ICommonDbGeocode } from '@interface/database/common-db';
import { CharNode } from "@usecases/geocode/models/trie/char-node";
import { TrieAddressFinder } from "@usecases/geocode/models/trie/trie-finder";
import { Transform, TransformCallback } from 'node:stream';
import { Query } from '../models/query';
import { QuerySet } from '../models/query-set';
import { WardTrieFinder } from '../models/ward-trie-finder';
import { trimDashAndSpace } from '../services/trim-dash-and-space';

export class WardTransform extends Transform {

  private readonly wardTrie: WardTrieFinder;
  private readonly db: ICommonDbGeocode;

  constructor(params: Required<{
    wardTrie: WardTrieFinder;
    db: ICommonDbGeocode;
  }>) {
    super({
      objectMode: true,
    });
    this.wardTrie = params.wardTrie;
    this.db = params.db;
  }

  async _transform(
    queries: QuerySet,
    _: BufferEncoding,
    callback: TransformCallback,
  ) {
    const results = new QuerySet();
    // ----------------------------------------------
    // 〇〇区から始まるパターンは、
    // 続く大字、町名、小字を調べないと分からないので
    // Databaseから取得して、動的にトライ木を作って探索する
    // ----------------------------------------------
    // 行政区が判明できているQueryと、そうでないQueryに分ける
    const targets: Query[] = [];
    for (const query of queries.values()) {
      if (query.match_level.num >= MatchLevel.CITY.num) {
        results.add(query);
      } else {
        targets.push(query);
      }
    }

    // 全て行政区が判明できているなら、スキップする
    if (targets.length === 0) {
      return callback(null, results);
    }

    // 〇〇区を全て探索すると効率が悪いので、
    // 類似度が高い（もしくは一致する）〇〇区を探す
    const possibleWards: WardMatchingInfo[] = [];
    const filteredTargets = targets.filter(query => {
      const target = trimDashAndSpace(query.tempAddress);
      if (!target) {
        // 探索する文字がなければスキップ
        results.add(query);
        return false;
      }

      // 〇〇市〇〇区 パターンを探す
      const searchResults2 = this.wardTrie.find({
        target,
        extraChallenges: ['市', '区'],
        fuzzy: DEFAULT_FUZZY_CHAR,
      });
      let anyHit = false;
      searchResults2?.forEach(result => {
        if (!result.info) {
          return;
        }

        if (query.match_level === MatchLevel.UNKNOWN) {
          anyHit = true;
          possibleWards.push(result.info);
          return;
        }

        if (
          query.match_level === MatchLevel.PREFECTURE &&
          query.pref_key === result.info.pref_key
        ) {
          anyHit = true;
          possibleWards.push(result.info);
        }
      });
      if (!anyHit) {
        results.add(query);
      }
      return anyHit;
    });

    // 可能性がありそうな〇〇区を指定して、トライ木を作成する
    for await (const ward of possibleWards) {

      // 対象がなくなればbreak
      if (targets.length === 0) {
        break;
      }

      const trie = new TrieAddressFinder<WardMatchingInfo>();

      // 〇〇区に所属する市町村を試す
      const townRows = await this.db.getWardRows({
        ward: ward.key,
        city_key: ward.city_key,
      });

      townRows.forEach(row => {
        // 〇〇市〇〇区〇〇大字
        trie.append({
          key: WardTrieFinder.normalizeStr(row.key),
          value: row,
        });
        const extraKey = `${row.ward}${row.oaza_cho || ''}`;
        if (extraKey !== row.key) {
          // 〇〇区〇〇大字
          trie.append({
            key: WardTrieFinder.normalizeStr(extraKey),
            value: row,
          });
        }
      });

      for (const query of filteredTargets) {
        const target = trimDashAndSpace(query.tempAddress);
        if (!target) {
          results.add(query);
          continue;
        }

        if (query.match_level.num > MatchLevel.PREFECTURE.num) {
          results.add(query);
          continue;
        } 

        const matched = trie.find({
          target,
          extraChallenges: ['市', '町', '村'],
          partialMatches: true,
          fuzzy: DEFAULT_FUZZY_CHAR,
        });

        if (!matched || matched.length === 0) {
          results.add(query);
          continue;
        }
        let anyAmbiguous = false;
        let anyHit = false;
        for (const mResult of matched) {
          if (query.pref_key !== mResult.info?.pref_key) {
            continue;
          }
          anyAmbiguous = anyAmbiguous || mResult.ambiguous;
          anyHit = true;

          // ここで大字を確定させると、rsdt_blk に入らなくなってしまうので、
          // あくまでも 〇〇区までに留める
          const oazaTmpAddress = (() => {
            if (!mResult.info!.oaza_cho) {
              return;
            }
            if (mResult.unmatched) {
              return mResult.unmatched.splice(0, 0, mResult.info!.oaza_cho);
            } else {
              return new CharNode({
                char: mResult.info!.oaza_cho,
              });
            }
          })();
          results.add(query.copy({
            pref_key: mResult.info!.pref_key,
            city_key: mResult.info!.city_key,
            pref: mResult.info!.pref,
            city: mResult.info!.city,
            lg_code: mResult.info!.lg_code,
            county: mResult.info!.county,
            ward: mResult.info!.ward,
            tempAddress: oazaTmpAddress,
            match_level: MatchLevel.MACHIAZA,
            rsdt_addr_flg: AMBIGUOUS_RSDT_ADDR_FLG,
            matchedCnt: query.matchedCnt + mResult.depth - mResult.info!.oaza_cho.length,
            rep_lat: mResult.info?.rep_lat,
            rep_lon: mResult.info?.rep_lon,
            coordinate_level: MatchLevel.CITY,
            ambiguousCnt: query.ambiguousCnt + (mResult.ambiguous ? 1 : 0), 
          }));
        }

        // 〇〇区で始まるパターンの場合、誤マッチングの可能性があるので
        // マッチしなかった可能性もキープしておく
        if (!anyHit || anyAmbiguous || query.match_level === MatchLevel.UNKNOWN) {
          results.add(query);
        }
      }
    }

    callback(null, results);
  }
}
