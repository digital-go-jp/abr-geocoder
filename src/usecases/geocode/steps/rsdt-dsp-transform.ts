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
import { RsdtDspInfo } from '@domain/types/geocode/rsdt-dsp-info';
import { SearchTarget } from '@domain/types/search-target';
import { GeocodeDbController } from '@interface/database/geocode-db-controller';
import { Transform, TransformCallback } from 'node:stream';
import { Query } from '../models/query';
import { CharNode } from '../services/trie/char-node';
import { TrieAddressFinder } from '../services/trie/trie-finder';
import { QuerySet } from '../models/query-set';

export class RsdtDspTransform extends Transform {

  constructor(private readonly params: Required<{
    dbCtrl: GeocodeDbController;
    logger: DebugLogger | undefined;
  }>) {
    super({
      objectMode: true,
    });
  }

  async _transform(
    queries: QuerySet,
    _: BufferEncoding,
    callback: TransformCallback
  ) {

    // ------------------------
    // 住居番号で当たるものがあるか
    // ------------------------
    const trie = new TrieAddressFinder<RsdtDspInfo>();
    for await (const query of queries.values()) {
      if (query.searchTarget === SearchTarget.PARCEL) {
        // 地番検索が指定されている場合、このステップはスキップする
        continue;
      }
      const db = await this.params.dbCtrl.openRsdtDspDb({
        lg_code: query.lg_code!,
        createIfNotExists: false,
      });
      if (!db) {
        continue;
      }
      const rows = await db.getRsdtDspRows({
        rsdtblk_key: query.rsdtblk_key!,
      });

      for (const row of rows) {
        const key = [row.rsdt_num, row.rsdt_num2].filter(x => x !== null).join(DASH);
        trie.append({
          key,
          value: row,
        });
      }
    }

    const results = new QuerySet();
    for await (const query of queries.values()) {

      if (query.searchTarget === SearchTarget.PARCEL) {
        // 地番検索が指定されている場合、このステップはスキップする
        results.add(query);
        continue;
      }
      // rsdtblk_key が必要なので、RESIDENTIAL_BLOCK未満はスキップ
      // もしくは 既に地番データが判明している場合もスキップ
      if (query.match_level.num < MatchLevel.RESIDENTIAL_BLOCK.num || 
        query.match_level === MatchLevel.PARCEL) {
        results.add(query);
        continue;
      }
      if (!query.tempAddress) {
        // 探索する文字がなければスキップ
        results.add(query);
        continue;
      }

      // rest_abr_flg = 0のものは地番を検索する
      if (query.rsdt_addr_flg === 0) {
        results.add(query);
        continue;
      }

      const target = query.tempAddress?.trimWith(DASH);
      if (!query.rsdtblk_key || !target) {
        results.add(query);
        continue;
      }
      const findResults = trie.find({
        target,
        fuzzy: DEFAULT_FUZZY_CHAR,
      });
      if (findResults === undefined || findResults.length === 0) {
        results.add(query);
        continue;
      }
      
      let anyAmbiguous = false;
      let anyHit = false;
      for (const findResult of findResults) {

        // マッチしていない文字の最初の文字が数字のときは、
        // 数字の途中でミスマッチしたときなので
        // 結果を使用しない
        if (findResult.unmatched?.char &&
          RegExpEx.create('^[0-9]$').test(findResult.unmatched.char)) {
          results.add(query);
          continue;
        }
        anyHit = true;
      
        // 番地がヒットした
        const info = findResult.info! as RsdtDspInfo;
        anyAmbiguous = anyAmbiguous || findResult.ambiguous;

        results.add(query.copy({
          rsdtdsp_key: info.rsdtdsp_key,
          rsdtblk_key: info.rsdtblk_key,
          rsdt_num: info.rsdt_num,
          rsdt_id: info.rsdt_id,
          rsdt_num2: info.rsdt_num2,
          rsdt2_id: info.rsdt2_id,
          rep_lat: info.rep_lat,
          rep_lon: info.rep_lon,
          tempAddress: findResult.unmatched,
          match_level: MatchLevel.RESIDENTIAL_DETAIL,
          coordinate_level: MatchLevel.RESIDENTIAL_DETAIL,
          matchedCnt: query.matchedCnt + findResult.depth,
          ambiguousCnt: query.ambiguousCnt + (findResult.ambiguous ? 1 : 0), 
        }));
      }
      if (!anyHit || anyAmbiguous) {
        results.add(query);
      }
    }

    // this.params.logger?.info(`rsdt-dsp : ${((Date.now() - results[0].startTime) / 1000).toFixed(2)} s`);
    callback(null, results);
  }
}