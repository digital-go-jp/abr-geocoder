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
import { RegExpEx } from '@domain/services/reg-exp-ex';
import { MatchLevel } from '@domain/types/geocode/match-level';
import { SearchTarget } from '@domain/types/search-target';
import { CharNode } from "@usecases/geocode/models/trie/char-node";
import { LRUCache } from 'lru-cache';
import { Transform, TransformCallback } from 'node:stream';
import { AbrGeocoderDiContainer } from '../models/abr-geocoder-di-container';
import { Query } from '../models/query';
import { QuerySet } from '../models/query-set';
import { RsdtDspTrieFinder } from '../models/rsdt-dsp-trie-finder';
import { trimDashAndSpace } from '../services/trim-dash-and-space';

export class RsdtDspTransform extends Transform {

  private readonly lgCodeToBuffer: LRUCache<string, Buffer> = new LRUCache<string, Buffer>({
    max: 10,
  });
  private readonly noDbLgCode: Set<string> = new Set();

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

    // ------------------------
    // 住居番号で当たるものがあるか
    // ------------------------
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
      if (query.rsdt_addr_flg === 0 || !query.rsdtblk_key || !query.lg_code) {
        results.add(query);
        continue;
      }

      // トライ木のデータを読み込む
      let trieData = this.lgCodeToBuffer.get(query.lg_code);
      if (!trieData) {
        trieData = await RsdtDspTrieFinder.loadDataFile({
          lg_code: query.lg_code,
          diContainer: this.diContainer,
        });
        this.lgCodeToBuffer.set(query.lg_code, trieData);
      }
      if (!trieData) {
        // データがなければスキップ
        results.add(query);
        this.noDbLgCode.add(query.lg_code);
        continue;
      }

      const queryInfo = this.getDetailNums(query);
      const finder = new RsdtDspTrieFinder(trieData);

      const key = [
        query.rsdtblk_key.toString() || '',
        queryInfo.rsdt_num || '',
        queryInfo.rsdt_num2 || '',
      ]
      .filter(x => x !== '')
      .join(':');

      let findResults = finder.find({
        target: CharNode.create(key),
        fuzzy: DEFAULT_FUZZY_CHAR,
      });
      if (findResults === undefined || findResults.length === 0) {
        results.add(query);
        continue;
      }
      
      let anyAmbiguous = false;
      let anyHit = false;
      for (const result of findResults) {

        // マッチしていない文字の最初の文字が数字のときは、
        // 数字の途中でミスマッチしたときなので
        // 結果を使用しない
        if (result.unmatched?.char &&
          RegExpEx.create('^[0-9]$').test(result.unmatched.char)) {
          results.add(query);
          continue;
        }
        anyHit = true;
      
        // 番地がヒットした
        anyAmbiguous = anyAmbiguous || result.ambiguousCnt > 0;
        const params: Record<string, CharNode | number | string | MatchLevel | undefined> = {
          rsdtdsp_key: result.info?.rsdtdsp_key,
          rsdtblk_key: result.info?.rsdtblk_key,
          rsdt_num: result.info?.rsdt_num,
          rsdt_id: result.info?.rsdt_id,
          rsdt_num2: result.info?.rsdt_num2,
          rsdt2_id: result.info?.rsdt2_id,
          tempAddress: result.unmatched?.concat(queryInfo.unmatched) || queryInfo.unmatched,
          match_level: MatchLevel.RESIDENTIAL_DETAIL,
          matchedCnt: query.matchedCnt + result.depth,
          ambiguousCnt: query.ambiguousCnt + result.ambiguousCnt, 
          rsdt_addr_flg: 1,
        };
        if (result.info?.rep_lat && result.info?.rep_lon) {
          params.coordinate_level = MatchLevel.RESIDENTIAL_DETAIL;
          params.rep_lat = result.info?.rep_lat;
          params.rep_lon = result.info?.rep_lon;
        }
        const copied = query.copy(params);
        results.add(copied);
      }
      if (!anyHit || anyAmbiguous) {
        results.add(query);
      }
    }

    queries.clear();

    callback(null, results);
  }

  // トライ木の作成に時間がかかるので、SQLの LIKE 演算子を使って
  // DB内を直接検索するための blk_num を作成する
  // fuzzyが含まれる可能性があるので、'_' に置換する
  // ('_'は、SQLiteにおいて、任意の一文字を示す)
  private getDetailNums(query: Query) {
    let p : CharNode | undefined = trimDashAndSpace(query.tempAddress);
    const buffer: string[] = [];
    const buffer2: string[] = [];
    // マッチした文字数
    let matchedCnt = 0;

    // Find the rsdt_num
    while (p) {
      if (p.char === DEFAULT_FUZZY_CHAR || RegExpEx.create('[0-9]').test(p.char!)) {
        buffer.push(p.char!);
        matchedCnt++;
      } else {
        break;
      }
      p = p.next;
    }

    // Find the rsdt_num2
    while (p) {
      if (p.char === DEFAULT_FUZZY_CHAR || RegExpEx.create('[0-9]').test(p.char!)) {
        buffer2.push(p.char!);
        matchedCnt++;
      } else {
        break;
      }
      p = p.next;
    }

    return {
      rsdt_num: buffer.join(''),
      rsdt_num2: buffer2.join(''),
      unmatched: p, 
      matchedCnt,
    };
  }
}
