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
import { DASH, DEFAULT_FUZZY_CHAR, SPACE } from '@config/constant-values';
import { DebugLogger } from '@domain/services/logger/debug-logger';
import { RegExpEx } from '@domain/services/reg-exp-ex';
import { MatchLevel } from '@domain/types/geocode/match-level';
import { TownMatchingInfo } from '@domain/types/geocode/town-info';
import { Transform, TransformCallback } from 'node:stream';
import timers from 'node:timers/promises';
import { QuerySet } from '../models/query-set';
import { jisKanji } from '../services/jis-kanji';
import { kan2num } from '../services/kan2num';
import { toHiragana } from '../services/to-hiragana';
import { TrieAddressFinder } from '../services/trie/trie-finder';

export class Tokyo23TownTranform extends Transform {

  private readonly tokyo23TownTrie: TrieAddressFinder<TownMatchingInfo>;
  private readonly logger: DebugLogger | undefined;
  private initialized: boolean = false;
  
  constructor(params: Required<{
    tokyo23towns: TownMatchingInfo[];
    logger: DebugLogger | undefined;
  }>) {
    super({
      objectMode: true,
    });
    this.logger = params.logger;

    // 東京23区を探すためのトライ木
    this.tokyo23TownTrie = new TrieAddressFinder<TownMatchingInfo>();
    setImmediate(() => {
      params.tokyo23towns.forEach(town => {
        const key = this.normalizeStr(town.key);
        this.tokyo23TownTrie.append({
          key,
          value: town,
        });
      });
      this.initialized = true;
    });
  }

  async _transform(
    queries: QuerySet,
    _: BufferEncoding,
    callback: TransformCallback,
  ) {
    const results = new QuerySet();
    for (const query of queries.values()) {
      const target = query.tempAddress?.
        replaceAll(RegExpEx.create(`^[${SPACE}${DASH}]`, 'g'), '')?.
        replaceAll(RegExpEx.create(`[${SPACE}${DASH}]$`, 'g'), '');
        
      // 行政区が判明している場合はスキップ
      if (!target || 
        query.match_level.num >= MatchLevel.CITY.num) {
        results.add(query);
        continue;
      }
      
      if (!this.initialized) {
        while (!this.initialized) {
          await timers.setTimeout(100);
        }
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

        results.add(query.copy({
          pref_key: searchResult.info.pref_key,
          city_key: searchResult.info.city_key,
          town_key: searchResult.info.town_key,
          rsdt_addr_flg: searchResult.info.rsdt_addr_flg,
          tempAddress: searchResult.unmatched,
          match_level: MatchLevel.MACHIAZA_DETAIL,
          coordinate_level: MatchLevel.MACHIAZA_DETAIL,
          matchedCnt: query.matchedCnt + searchResult.depth,
          rep_lat: searchResult.info.rep_lat,
          rep_lon: searchResult.info.rep_lon,
          koaza: searchResult.info.koaza,
          pref: searchResult.info.pref,
          county: searchResult.info.county,
          city: searchResult.info.city,
          ward: searchResult.info.ward,
          lg_code: searchResult.info.lg_code,
          oaza_cho: searchResult.info.oaza_cho,
          machiaza_id: searchResult.info.machiaza_id,
          chome: searchResult.info.chome,
          ambiguousCnt: query.ambiguousCnt + (searchResult.ambiguous ? 1 : 0), 
        }));
      });
      if (!anyHit || anyAmbiguous) {
        results.add(query);
      }
    }

    // this.logger?.info(`tokyo23 : ${((Date.now() - results[0].startTime) / 1000).toFixed(2)} s`);
    callback(null, results);
  }

  private normalizeStr(address: string): string {
    // 片仮名を平仮名に変換する
    address = toHiragana(address);

    // 漢数字を半角数字に変換する
    address = kan2num(address);
    
    // JIS 第2水準 => 第1水準 及び 旧字体 => 新字体
    address = jisKanji(address);

    // 〇〇番地[〇〇番ー〇〇号]、の [〇〇番ー〇〇号] だけを取る
    address = address?.replaceAll(RegExpEx.create(`(\\d+)${DASH}?[番号町地丁目]+の?`, 'g'), `$1${DASH}`);

    return address;
  }
}
