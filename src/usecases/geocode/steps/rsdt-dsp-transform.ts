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
import { RegExpEx } from '@domain/services/reg-exp-ex';
import { MatchLevel } from '@domain/types/geocode/match-level';
import { RsdtDspInfo } from '@domain/types/geocode/rsdt-dsp-info';
import { SearchTarget } from '@domain/types/search-target';
import { CharNode } from "@usecases/geocode/models/trie/char-node";
import { TrieAddressFinder } from "@usecases/geocode/models/trie/trie-finder";
import { Transform, TransformCallback } from 'node:stream';
import { AbrGeocoderDiContainer } from '../models/abr-geocoder-di-container';
import { QuerySet } from '../models/query-set';
import { trimDashAndSpace } from '../services/trim-dash-and-space';

export class RsdtDspTransform extends Transform {

  constructor(
    private readonly diContainer: AbrGeocoderDiContainer,
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

    const trieCache = new Map<number, TrieAddressFinder<RsdtDspInfo>>();
    // ------------------------
    // 住居番号で当たるものがあるか
    // ------------------------
    for await (const query of queries.values()) {
      if (query.rsdt_addr_flg === 0 || !query.rsdtblk_key) {
        continue;
      }
      if (query.city === '京都市') {
        // 京都市がマッチしている場合、スキップする
        // (京都市は住居表示を行っていない)
        continue;
      }
      if (query.searchTarget === SearchTarget.PARCEL) {
        // 地番検索が指定されている場合、このステップはスキップする
        continue;
      }
      if (trieCache.has(query.rsdtblk_key)) {
        continue;
      }
      const db = await this.diContainer.database.openRsdtDspDb({
        lg_code: query.lg_code!,
        createIfNotExists: false,
      });
      if (!db) {
        continue;
      }
      const rows = await db.getRsdtDspRows({
        rsdtblk_key: query.rsdtblk_key,
      });
      db.close();

      const trie = new TrieAddressFinder<RsdtDspInfo>();
      for (const row of rows) {
        const key = [
          row.rsdt_num,
          row.rsdt_num2,
        ].filter(x => x !== null).join(DASH);
        trie.append({
          key,
          value: row,
        });
      }
      trieCache.set(query.rsdtblk_key, trie);
    }

    const results = new QuerySet();
    for await (const query of queries.values()) {

      if (query.city === '京都市') {
        // 京都市がマッチしている場合、スキップする
        // (京都市は住居表示を行っていない)
        results.add(query);
        continue;
      }
      
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

      const target = trimDashAndSpace(query.tempAddress);
      if (!target) {
        results.add(query);
        continue;
      }

      // rest_abr_flg = 0のものは地番を検索する
      if (query.rsdt_addr_flg === 0 || !query.rsdtblk_key || !trieCache.has(query.rsdtblk_key)) {
        results.add(query);
        continue;
      }
      const trie = trieCache.get(query.rsdtblk_key)!;
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
        anyAmbiguous = anyAmbiguous || findResult.ambiguousCnt > 0;
        const params: Record<string, CharNode | number | string | MatchLevel | undefined> = {
          rsdtdsp_key: info.rsdtdsp_key,
          rsdtblk_key: info.rsdtblk_key,
          rsdt_num: info.rsdt_num,
          rsdt_id: info.rsdt_id,
          rsdt_num2: info.rsdt_num2,
          rsdt2_id: info.rsdt2_id,
          tempAddress: findResult.unmatched,
          match_level: MatchLevel.RESIDENTIAL_DETAIL,
          matchedCnt: query.matchedCnt + findResult.depth,
          ambiguousCnt: query.ambiguousCnt + findResult.ambiguousCnt, 
          rsdt_addr_flg: 1,
        };
        if (info.rep_lat && info.rep_lon) {
          params.coordinate_level = MatchLevel.RESIDENTIAL_DETAIL;
          params.rep_lat = info.rep_lat;
          params.rep_lon = info.rep_lon;
        }
        const copied = query.copy(params);
        results.add(copied);
      }
      if (!anyHit || anyAmbiguous) {
        results.add(query);
      }
    }

    queries.clear();
    trieCache.clear();

    callback(null, results);
  }
}
