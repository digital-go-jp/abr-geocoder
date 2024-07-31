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
import { DebugLogger } from '@domain/services/logger/debug-logger';
import { RegExpEx } from '@domain/services/reg-exp-ex';
import { ChomeMachingInfo } from '@domain/types/geocode/chome-info';
import { MatchLevel } from '@domain/types/geocode/match-level';
import { ICommonDbGeocode } from '@interface/database/common-db';
import { Transform, TransformCallback } from 'node:stream';
import { Query } from '../models/query';
import { jisKanji, jisKanjiForCharNode } from '../services/jis-kanji';
import { kan2num, kan2numForCharNode } from '../services/kan2num';
import { toHiragana, toHiraganaForCharNode } from '../services/to-hiragana';
import { CharNode } from '../services/trie/char-node';
import { TrieAddressFinder } from '../services/trie/trie-finder';

export class ChomeTranform extends Transform {

  constructor(private params: Required<{
    db: ICommonDbGeocode;
    logger: DebugLogger | undefined;
  }>) {
    super({
      objectMode: true,
    });
  }

  private createWhereCondition(query: Query) {
    
    const conditions: Partial<{
      pref_key: number;
      city_key: number;
      town_key: number;
      oaza_cho: string;
    }> = {};
    let anyHit = false;
    if (query.pref_key) {
      anyHit = true;
      conditions.pref_key = query.pref_key;
    }
    if (query.city_key) {
      anyHit = true;
      conditions.city_key = query.city_key;
    }
    if (query.town_key) {
      anyHit = true;
      conditions.town_key = query.town_key;
    }
    if (query.oaza_cho) {
      anyHit = true;
      // 紀尾井町のように「丁目」がない場合もある
      // この場合 city_key の千代田区 だけで検索すると、別の地域の「一丁目」にマッチしてしまう
      // なので、大字が判明しているときは、条件に加える
      conditions.oaza_cho = query.oaza_cho;
    }
    if (!anyHit) {
      return undefined;
    }
    return conditions;
  }

  async _transform(
    queries: Query[],
    _: BufferEncoding,
    callback: TransformCallback
  ) {
    // ------------------------
    // 丁目で当たるものがあるか
    // ------------------------
    const results: Query[] = [];
    for await (const query of queries) {

      // 丁目を探索するためには、最低限でも city_key が分かっている必要がある。)
      // match_level = unknow, prefecture はスキップする
      if (query.match_level.num < MatchLevel.CITY.num) {
        results.push(query);
        continue;
      }

      // 丁目が既に判明している場合はスキップ
      if (query.match_level.num >= MatchLevel.MACHIAZA_DETAIL.num) {
        results.push(query);
        continue;
      }
      
      if (!query.tempAddress) {
        // 探索する文字がなければスキップ
        results.push(query);
        continue;
      }

      // ------------------------------------
      // Queryの情報を使って、DBから情報を取得する
      // ------------------------------------
      const conditions = this.createWhereCondition(query);
      if (!conditions) {
        // 探索する条件が絞り込めなければスキップ
        results.push(query);
        continue;
      }

      const rows = await this.params.db.getChomeRows(conditions);
  
      const trie = new TrieAddressFinder<ChomeMachingInfo>();
      for (const row of rows) {
        const key = this.normalizeStr(row.chome);
        trie.append({
          key,
          value: row
        });
      }

      // ------------------------------------
      // トライ木を使って探索
      // ------------------------------------
      const target = this.normalizeCharNode(query.tempAddress);
      if (!target) {
        results.push(query);
        continue;
      }
      const findResults = trie.find({
        target,
        fuzzy: DEFAULT_FUZZY_CHAR,
      });
      
      let anyHit = false;
      let anyAmbiguous = false;

      // 複数にヒットする可能性が高いので、全て試す
      findResults?.forEach(findResult => {
        if (!findResult.info) {
          throw new Error('findResult.info is empty');
        }

        // step2, step3で city_key が判別している場合で
        // city_key が異なる場合はスキップ
        if ((query.city_key !== undefined) && 
          (query.city_key !== findResult.info.city_key)) {
            return;
        }
        anyAmbiguous = anyAmbiguous || findResult.ambiguous;

        // 丁目がヒットした
        results.push(query.copy({
          chome: findResult.info.chome,
          tempAddress: findResult.unmatched,
          town_key: findResult.info.town_key,
          rsdt_addr_flg: findResult.info.rsdt_addr_flg,
          machiaza_id: findResult.info.machiaza_id,
          match_level: MatchLevel.MACHIAZA_DETAIL,
          matchedCnt: query.matchedCnt + findResult.depth,
          rep_lat: findResult.info.rep_lat,
          rep_lon: findResult.info.rep_lon,
          koaza: findResult.info.koaza,
          coordinate_level: MatchLevel.MACHIAZA_DETAIL,
          ambiguousCnt: query.ambiguousCnt + (findResult.ambiguous ? 1 : 0), 
        }));

        anyHit = true;
      });

      if (!anyHit || anyAmbiguous) {
        results.push(query);
      }
    }

    this.params.logger?.info(`chome : ${((Date.now() - results[0].startTime) / 1000).toFixed(2)} s`);
    callback(null, results);
  }
  
  private normalizeStr(address: string): string {
    // 漢数字を半角数字に変換する
    address = kan2num(address);

    // カタカナはひらがなに変換する
    address = toHiragana(address);
    
    // JIS 第2水準 => 第1水準 及び 旧字体 => 新字体
    address = jisKanji(address);
    
    // 「丁目」をDASH に変換する
    // 大阪府堺市は「丁目」の「目」が付かないので「目?」としている
    address = address?.replaceAll(RegExpEx.create('丁目?', 'g'), DASH);

    // input =「丸の内一の八」のように「ハイフン」を「の」で表現する場合があるので
    // 「の」は全部DASHに変換する
    address = address?.replaceAll(RegExpEx.create('の', 'g'), DASH);

    return address;
  }
  
  private normalizeCharNode(address: CharNode | undefined): CharNode | undefined {

    // 漢数字を半角数字に変換する
    address = kan2numForCharNode(address);

    // カタカナはひらがなに変換する
    address = toHiraganaForCharNode(address);

    // JIS 第2水準 => 第1水準 及び 旧字体 => 新字体
    address = jisKanjiForCharNode(address);
    
    // 「丁目」をDASH に変換する
    // 大阪府堺市は「丁目」の「目」が付かないので「目?」としている
    address = address?.replaceAll(RegExpEx.create('丁目?', 'g'), DASH);

    // input =「丸の内一の八」のように「ハイフン」を「の」で表現する場合があるので
    // 「の」は全部DASHに変換する
    address = address?.replaceAll(RegExpEx.create('の', 'g'), DASH);

    return address;
  }
}