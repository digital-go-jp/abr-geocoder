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
import { Transform, TransformCallback } from 'node:stream';
import { toHiragana } from '../services/to-hiragana';
import { Query } from '../models/query';
import { jisKanji } from '../services/jis-kanji';
import { kan2num } from '../services/kan2num';
import { TrieAddressFinder } from '../services/trie/trie-finder';
import { MatchLevel } from '@domain/types/geocode/match-level';
import { PrefInfo } from '@domain/types/geocode/pref-info';
import { DebugLogger } from '@domain/services/logger/debug-logger';
import { DEFAULT_FUZZY_CHAR } from '@config/constant-values';

export class PrefTransform extends Transform {

  private readonly prefTrie: TrieAddressFinder<PrefInfo>;
  private readonly logger: DebugLogger | undefined;

  constructor(params: Required<{
    prefList: PrefInfo[];
    logger: DebugLogger | undefined;
  }>) {
    super({
      objectMode: true,
    });
    this.logger = params.logger;

    // 都道府県のトライ木
    this.prefTrie = new TrieAddressFinder<PrefInfo>();
    for (const prefInfo of params.prefList) {
      this.prefTrie.append({
        key: this.normalizeStr(prefInfo.pref),
        value: prefInfo,
      });
    }
  }

  _transform(
    queries: Query[],
    _: BufferEncoding,
    next: TransformCallback
  ): void {

    const results = [];
    for (const query of queries) {
      // --------------------
      // 都道府県を探索する
      // --------------------
      const matched = this.prefTrie.find({
        target: query.tempAddress!,

        // マッチしなかったときに、unmatchAttemptsに入っている文字列を試す。
        extraChallenges: ['道', '都', '府', '県'],
        
        fuzzy: DEFAULT_FUZZY_CHAR,
      });

      if (!matched) {
        results.push(query);
        break;
      }
      let anyHit = false;
      for (const mResult of matched) {
        if (!mResult.info) {
          continue;
        }
        anyHit = true;
        results.push(query.copy({
          pref_key: mResult.info.pref_key,
          tempAddress: mResult.unmatched,
          rep_lat: mResult.info.rep_lat,
          rep_lon: mResult.info.rep_lon,
          lg_code: mResult.info.lg_code,
          pref: mResult.info.pref,
          match_level: MatchLevel.PREFECTURE,
          coordinate_level: MatchLevel.PREFECTURE,
          matchedCnt: mResult.depth,
        }));
      }
      if (!anyHit) {
        results.push(query);
      }
    }

    this.logger?.info(`prefecture : ${((Date.now() - results[0].startTime) / 1000).toFixed(2)} `);
    next(null, results);
  }

  private normalizeStr(value: string): string {
    // 半角カナ・全角カナ => 平仮名
    value = toHiragana(value);

    // JIS 第2水準 => 第1水準 及び 旧字体 => 新字体
    value = jisKanji(value);

    // 漢数字 => 算用数字
    value = kan2num(value);

    return value;
  }
}
