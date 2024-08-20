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
import { AMBIGUOUS_RSDT_ADDR_FLG, DASH, DEFAULT_FUZZY_CHAR, SPACE } from '@config/constant-values';
import { DebugLogger } from '@domain/services/logger/debug-logger';
import { RegExpEx } from '@domain/services/reg-exp-ex';
import { MatchLevel } from '@domain/types/geocode/match-level';
import { WardMatchingInfo } from '@domain/types/geocode/ward-info';
import { ICommonDbGeocode } from '@interface/database/common-db';
import { Transform, TransformCallback } from 'node:stream';
import timers from 'node:timers/promises';
import { Query } from '../models/query';
import { QuerySet } from '../models/query-set';
import { jisKanji } from '../services/jis-kanji';
import { toHankakuAlphaNum } from '../services/to-hankaku-alpha-num';
import { toHiragana } from '../services/to-hiragana';
import { CharNode } from '../services/trie/char-node';
import { TrieAddressFinder } from '../services/trie/trie-finder';

export class WardTransform extends Transform {

  private readonly wardTrie: TrieAddressFinder<WardMatchingInfo>;
  private readonly logger: DebugLogger | undefined;
  private readonly db: ICommonDbGeocode;
  private initialized: boolean = false;

  constructor(params: Required<{
    wards: WardMatchingInfo[];
    db: ICommonDbGeocode;
    logger: DebugLogger | undefined;
  }>) {
    super({
      objectMode: true,
    });
    this.logger = params.logger;
    this.db = params.db;

    // 〇〇区を探すためのトライ木
    this.wardTrie = new TrieAddressFinder<WardMatchingInfo>();
    setImmediate(() => {
      params.wards.forEach(ward => this.wardTrie.append({
        key: this.normalizeStr(ward.key),
        value: ward,
      }));
      this.initialized = true;
    });
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

    // 初期化が完了していなければ待機
    if (!this.initialized) {
      while (!this.initialized) {
        await timers.setTimeout(100);
      }
    }

    // 〇〇区を全て探索すると効率が悪いので、
    // 類似度が高い（もしくは一致する）〇〇区を探す
    const possibleWards: WardMatchingInfo[] = [];
    const filteredTargets = targets.filter(query => {
      if (!query.tempAddress) {
        // 探索する文字がなければスキップ
        results.add(query);
        return false;
      }

      // 〇〇市〇〇区 パターンを探す
      const searchResults2 = this.wardTrie.find({
        target: query.tempAddress,
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

      townRows.forEach(row => trie.append({
        key: this.normalizeStr(row.key),
        value: row,
      }));

      for (const query of filteredTargets) {
        if (!query.tempAddress) {
          results.add(query);
          continue;
        }

        if (query.match_level.num > MatchLevel.PREFECTURE.num) {
          results.add(query);
          continue;
        } 

        const target = query.tempAddress?.
          replaceAll(RegExpEx.create(`^[${SPACE}${DASH}]`, 'g'), '')?.
          replaceAll(RegExpEx.create(`[${SPACE}${DASH}]$`, 'g'), '');
        if (!target) {
          results.add(query);
          continue;
        }
        const matched = trie.find({
          target,
          extraChallenges: ['市', '町', '村'],
          partialMatches: true,
          fuzzy: DEFAULT_FUZZY_CHAR,
        });

        if (!matched) {
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

    // if (results.length > 0) {
    //   this.logger?.info(`ward : ${((Date.now() - results[0].startTime) / 1000).toFixed(2)} s`);
    // } else {
    //   this.logger?.info(`ward : ${((Date.now() - targets[0].startTime) / 1000).toFixed(2)} s`);
    // }
    callback(null, results);
  }


  private normalizeStr(address: string): string {

    // 漢数字を半角英数字にする
    address = toHankakuAlphaNum(address);

    // JIS 第2水準 => 第1水準 及び 旧字体 => 新字体
    address = jisKanji(address);

    // カタカナは全てひらがなにする（南アルプス市）
    address = toHiragana(address);

    return address;
  }
}
