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
import { DASH } from '@config/constant-values';
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

export class RsdtDspTransform extends Transform {

  //private readonly trieCache = new LRUCache<number, TrieAddressFinder<RsdtDspInfo>>({max: 10});

  constructor(private readonly params: Required<{
    fuzzy: string | undefined;
    searchTarget: SearchTarget;
    dbCtrl: GeocodeDbController;
    logger: DebugLogger | undefined;
  }>) {
    super({
      objectMode: true,
    });
  }

  async _transform(
    queries: Query[],
    _: BufferEncoding,
    callback: TransformCallback
  ) {
    if (this.params.searchTarget === SearchTarget.PARCEL) {
      // 地番検索が指定されている場合、このステップはスキップする
      return callback(null, queries);
    }

    // ------------------------
    // 住居番号で当たるものがあるか
    // ------------------------
    const trie = new TrieAddressFinder<RsdtDspInfo>({
      fuzzy: this.params.fuzzy,
    });
    for await (const query of queries) {
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

    const results: Query[] = [];
    for await (const query of queries) {

      // rsdtblk_key が必要なので、RESIDENTIAL_BLOCK未満はスキップ
      // もしくは 既に地番データが判明している場合もスキップ
      if (query.match_level.num < MatchLevel.RESIDENTIAL_BLOCK.num || 
        query.match_level === MatchLevel.PARCEL) {
        results.push(query);
        continue;
      }
      if (!query.tempAddress) {
        // 探索する文字がなければスキップ
        results.push(query);
        continue;
      }

      // rest_abr_flg = 0のものは地番を検索する
      if (query.rsdt_addr_flg === 0) {
        results.push(query);
        continue;
      }

      const target = this.normalizeCharNode(query.tempAddress);
      if (!query.rsdtblk_key || !target) {
        results.push(query);
        continue;
      }
      const findResults = trie.find({
        target,
      });
      if (findResults === undefined || findResults.length === 0) {
        results.push(query);
        continue;
      }
      
      // 1つしかヒットしないはず
      const findResult = findResults[0];

      // マッチしていない文字の最初の文字が数字のときは、
      // 数字の途中でミスマッチしたときなので
      // 結果を使用しない
      if (findResult.unmatched?.char &&
        RegExpEx.create('^[0-9]$').test(findResult.unmatched.char)) {
        results.push(query);
        continue;
      }
    
      // 番地がヒットした
      const info = findResult.info! as RsdtDspInfo;

      results.push(query.copy({
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
      }));
    }

    this.params.logger?.info(`rsdt-dsp : ${((Date.now() - results[0].startTime) / 1000).toFixed(2)} s`);
    callback(null, results);
  }

  private normalizeCharNode(address: CharNode | undefined): CharNode | undefined {
    // 先頭にDashがある場合、削除する
    address = address?.replace(RegExpEx.create(`^${DASH}+`), '');
    
    // 〇〇番地[〇〇番ー〇〇号]、の [〇〇番ー〇〇号] だけを取る
    address = address?.replaceAll(RegExpEx.create('(\d+)[番(?:番地)号の]', 'g'), `$1${DASH}`);

    // input =「丸の内一の八」のように「ハイフン」を「の」で表現する場合があるので
    // 「の」は全部DASHに変換する
    address = address?.replaceAll(RegExpEx.create('の', 'g'), DASH);

    // 末尾のDASHがある場合、削除する
    address = address?.replace(RegExpEx.create(`${DASH}+$`), '');

    return address;
  }
}