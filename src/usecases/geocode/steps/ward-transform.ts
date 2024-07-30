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
import { MatchLevel } from '@domain/types/geocode/match-level';
import { WardMatchingInfo } from '@domain/types/geocode/ward-info';
import { ICommonDbGeocode } from '@interface/database/common-db';
import { Transform, TransformCallback } from 'node:stream';
import { Query } from '../models/query';
import { jisKanji, jisKanjiForCharNode } from '../services/jis-kanji';
import { toHankakuAlphaNum, toHankakuAlphaNumForCharNode } from '../services/to-hankaku-alpha-num';
import { toHiragana, toHiraganaForCharNode } from '../services/to-hiragana';
import { TrieAddressFinder } from '../services/trie/trie-finder';
import { DebugLogger } from '@domain/services/logger/debug-logger';
import { CharNode } from '../services/trie/char-node';
import timers from 'node:timers/promises';
import { DEFAULT_FUZZY_CHAR } from '@config/constant-values';

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
    })
  }

  async _transform(
    queries: Query[],
    _: BufferEncoding,
    callback: TransformCallback
  ) {
    // ----------------------------------------------
    // 〇〇区から始まるパターンは、
    // 続く大字、町名、小字を調べないと分からないので
    // Databaseから取得して、動的にトライ木を作って探索する
    // ----------------------------------------------
    // 行政区が判明できているQueryと、そうでないQueryに分ける
    const results: Query[] = [];
    let targets: Query[] = [];
    queries.forEach(query => {
      if (query.match_level.num >= MatchLevel.CITY.num) {
        results.push(query);
      } else {
        targets.push(query);
      }
    });

    // 全て行政区が判明できているなら、スキップする
    if (targets.length === 0) {
      return callback(null, results);
    }

    await new Promise(async (resolve: (_?: unknown[]) => void) => {
      while (!this.initialized) {
        await timers.setTimeout(100);
      }
      resolve();
    });

    // 〇〇区を全て探索すると効率が悪いので、
    // 類似度が高い（もしくは一致する）〇〇区を探す
    const possibleWards: WardMatchingInfo[] = [];
    targets.forEach(query => {
      if (!query.tempAddress) {
        // 探索する文字がなければスキップ
        results.push(query);
        return false;
      }

      // 〇〇市〇〇区　パターンを探す
      const searchResults2 = this.wardTrie.find({
        target: this.normalizeCharNode(query.tempAddress)!,
        extraChallenges: ['市', '区'],
        fuzzy: DEFAULT_FUZZY_CHAR,
      });
      searchResults2?.forEach(result => {
        if (!result.info) {
          return;
        }

        if (query.match_level === MatchLevel.UNKNOWN) {
          possibleWards.push(result.info);
          return;
        }

        if (
          query.match_level === MatchLevel.PREFECTURE &&
          query.pref_key === result.info.pref_key
        ) {
          possibleWards.push(result.info);
          return;
        }
      })
    })

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

      // マッチしないQuery は、次の探索に掛ける
      const unmatched: Query[] = [];
      targets.forEach(query => {
        if (!query.tempAddress) {
          return query;
        }
        let hitResult = trie.find({
          target: this.normalizeCharNode(query.tempAddress)!,
          extraChallenges: ['市', '町', '村'],
          partialMatches: true,
          fuzzy: DEFAULT_FUZZY_CHAR,
        });

        if (!hitResult) {
          unmatched.push(query);
          return;
        }

        hitResult = hitResult.filter(result => {
          if (query.match_level === MatchLevel.UNKNOWN ||
            query.match_level.num === MatchLevel.PREFECTURE.num &&
            query.pref_key === result.info?.pref_key) {

            // ここで大字を確定させると、rsdt_blk に入らなくなってしまうので、
            // あくまでも 〇〇区までに留める
            const oazaTmpAddress = (() => {
              if (!result.info!.oaza_cho) {
                return;
              }
              if (result.unmatched) {
                return result.unmatched.splice(0, 0, result.info!.oaza_cho);
              } else {
                return new CharNode(result.info!.oaza_cho);
              }
            })();

            results.push(query.copy({
              pref_key: result.info!.pref_key,
              city_key: result.info!.city_key,
              pref: result.info!.pref,
              city: result.info!.city,
              lg_code: result.info!.lg_code,
              county: result.info!.county,
              ward: result.info!.ward,
              tempAddress: oazaTmpAddress,
              match_level: MatchLevel.MACHIAZA,
              matchedCnt: query.matchedCnt + result.depth - result.info!.oaza_cho.length,
              rep_lat: result.info?.rep_lat,
              rep_lon: result.info?.rep_lon,
              coordinate_level: MatchLevel.CITY,
            }));
            return true;
          } else {
            return false;
          }
        });

        if (hitResult.length === 0) {
          unmatched.push(query);
        } else {
          // 〇〇区で始まるパターンの場合、誤マッチングの可能性があるので
          // マッチしなかった可能性もキープしておく
          if (query.match_level === MatchLevel.UNKNOWN) {
            results.push(query);
          }
        }
      });

      targets = unmatched;
    }

    if (results.length > 0) {
      this.logger?.info(`ward : ${((Date.now() - results[0].startTime) / 1000).toFixed(2)} s`);
    } else {
      this.logger?.info(`ward : ${((Date.now() - targets[0].startTime) / 1000).toFixed(2)} s`);
    }
    callback(null, [results, targets].flat());
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
  private normalizeCharNode(address: CharNode | undefined): CharNode | undefined {

    // 漢数字を半角英数字にする
    address = toHankakuAlphaNumForCharNode(address);

    // JIS 第2水準 => 第1水準 及び 旧字体 => 新字体
    address = jisKanjiForCharNode(address);

    // カタカナは全てひらがなにする（南アルプス市）
    address = toHiraganaForCharNode(address);

    return address;
  }
}
