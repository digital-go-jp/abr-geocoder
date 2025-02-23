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
import { RegExpEx } from '@domain/services/reg-exp-ex';
import { MatchLevel } from '@domain/types/geocode/match-level';
import { SearchTarget } from '@domain/types/search-target';
import { CharNode } from "@usecases/geocode/models/trie/char-node";
import { Transform, TransformCallback } from 'node:stream';
import { AbrGeocoderDiContainer } from '../models/abr-geocoder-di-container';
import { Query } from '../models/query';
import { QuerySet } from '../models/query-set';
import { trimDashAndSpace } from '../services/trim-dash-and-space';

export class RsdtBlkTransform extends Transform {

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

    const results = new QuerySet();
    for await (const query of queries.values()) {
      if (query.searchTarget === SearchTarget.PARCEL) {
        // 地番検索が指定されている場合、このステップはスキップする
        results.add(query);
        continue;
      }
      if (query.city === '京都市') {
        // 京都市がマッチしている場合、スキップする
        // (京都市は住居表示を行っていない)
        results.add(query);
        continue;
      }

      // town_key が必要なので、TOWN_LOCAL未満はスキップ
      // もしくは 既に地番データが判明している場合もスキップ
      if (query.match_level.num < MatchLevel.MACHIAZA.num || 
        query.match_level === MatchLevel.PARCEL) {
        results.add(query);
        continue;
      }
      if (!query.tempAddress) {
        // 探索する文字がなければスキップ
        results.add(query);
        continue;
      }

      // rsdt_addr_flg = 0のものは地番を検索する
      // (データが間違えていることが判明したので、rsdt_addr_flg を参照しない)
      // if (query.rsdt_addr_flg === 0) {
      //   results.push(query);
      //   continue;
      // }

      if (!query.town_key) {
        results.add(query);
        continue;
      }
      if (!query.lg_code) {
        results.add(query);
        continue;
      }

      const db = await this.diContainer.database.openRsdtBlkDb({
        lg_code: query.lg_code,
        createIfNotExists: false,
      });
      if (!db) {
        // DBをオープンできなければスキップ
        results.add(query);
        continue;
      }

      // ------------------------
      // 街区符号で当たるものがあるか
      // ------------------------
      const queryInfo = this.getBlockNum(query);
      const findResults = await db.getBlockNumRows({
        town_key: query.town_key,
        blk_num: queryInfo.block_num,
      });
      
      db.close();

      // 住居表示が間違えている可能性があるので、地番のために残しておく
      results.add(query);
      
      findResults.forEach(result => {
        const params: Record<string, CharNode | number | string | MatchLevel | undefined> = {
          block: result.blk_num.toString(),
          block_id: result.blk_id,
          rsdtblk_key: result.rsdtblk_key,
          tempAddress: queryInfo.unmatched,
          match_level: MatchLevel.RESIDENTIAL_BLOCK,
          matchedCnt: query.matchedCnt + queryInfo.matchedCnt,
          rsdt_addr_flg: 1,
        };
        if (result.rep_lat && result.rep_lon) {
          params.coordinate_level = MatchLevel.RESIDENTIAL_BLOCK;
          params.rep_lat = result.rep_lat;
          params.rep_lon = result.rep_lon;
        }
        const copied = query.copy(params);
        results.add(copied);
      });
    }

    queries.clear();

    callback(null, results);
  }

  // トライ木の作成に時間がかかるので、SQLの LIKE 演算子を使って
  // DB内を直接検索するための blk_num を作成する
  // fuzzyが含まれる可能性があるので、'_' に置換する
  // ('_'は、SQLiteにおいて、任意の一文字を示す)
  private getBlockNum(query: Query) {
    let p : CharNode | undefined = trimDashAndSpace(query.tempAddress);
    const buffer: string[] = [];
    // マッチした文字数
    let matchedCnt = 0;

    while (p) {
      if (p.char === DEFAULT_FUZZY_CHAR) {
        // fuzzyの場合、任意の１文字
        // TODO: Databaseごとの処理に対応させる
        buffer.push('_');
        matchedCnt++;
      } else if (RegExpEx.create('[0-9]').test(p.char!)) {
        buffer.push(p.char!);
        matchedCnt++;
      } else {
        break;
      }
      p = p.next;
    }

    // レアケースで「渡辺」という番地がある
    if (matchedCnt === 0) {
      p = query.tempAddress;
      while (p) {
        if (p.char === SPACE || p.char === DASH) {
          break;
        }
        matchedCnt++;
        buffer.push(p.char!);
        p = p.next;
      }
    }

    return {
      block_num: buffer.join(''),
      block_id: query.block_id!,
      unmatched: p, 
      matchedCnt,
    };
  }
}
