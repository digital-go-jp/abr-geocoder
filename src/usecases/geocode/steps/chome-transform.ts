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
import { ChomeMachingInfo } from '@domain/types/geocode/chome-info';
import { MatchLevel } from '@domain/types/geocode/match-level';
import { ICommonDbGeocode } from '@interface/database/common-db';
import { CharNode } from "@usecases/geocode/models/trie/char-node";
import { TrieAddressFinder } from "@usecases/geocode/models/trie/trie-finder";
import { Transform, TransformCallback } from 'node:stream';
import { Query } from '../models/query';
import { QuerySet } from '../models/query-set';
import { jisKanji, jisKanjiForCharNode } from '../services/jis-kanji';
import { kan2num, kan2numForCharNode } from '../services/kan2num';
import { toHankakuAlphaNum } from '../services/to-hankaku-alpha-num';
import { toHiragana, toHiraganaForCharNode } from '../services/to-hiragana';
import { trimDashAndSpace } from '../services/trim-dash-and-space';

export class ChomeTranform extends Transform {

  constructor(
    private readonly db: ICommonDbGeocode,
  ) {
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
    queries: QuerySet,
    _: BufferEncoding,
    callback: TransformCallback,
  ) {
    // ------------------------
    // 丁目で当たるものがあるか
    // ------------------------
    const results = new QuerySet();
    for await (const query of queries.values()) {

      if (query.koaza_aka_code === 2) {
        // 通り名が当たっている場合はスキップ
        results.add(query);
        continue;
      }
      
      // 丁目を探索するためには、最低限でも city_key が分かっている必要がある。)
      // match_level = unknow, prefecture はスキップする
      if (query.match_level.num < MatchLevel.CITY.num) {
        results.add(query);
        continue;
      }

      // 丁目が既に判明している場合はスキップ
      if (query.match_level.num >= MatchLevel.MACHIAZA_DETAIL.num) {
        results.add(query);
        continue;
      }
      
      if (!query.tempAddress) {
        // 探索する文字がなければスキップ
        results.add(query);
        continue;
      }

      // ------------------------------------
      // Queryの情報を使って、DBから情報を取得する
      // ------------------------------------
      const conditions = this.createWhereCondition(query);
      if (!conditions) {
        // 探索する条件が絞り込めなければスキップ
        results.add(query);
        continue;
      }

      const rows = await this.db.getChomeRows(conditions);
  
      const trie = new TrieAddressFinder<ChomeMachingInfo>();
      for (const row of rows) {
        const key = this.normalizeStr(row.chome);
        trie.append({
          key,
          value: row,
        });
      }

      // ------------------------------------
      // トライ木を使って探索
      // ------------------------------------
      const target = trimDashAndSpace(query.tempAddress);
      if (!target) {
        results.add(query);
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
        const params: Record<string, CharNode | number | string | MatchLevel> = {
          chome: findResult.info.chome,
          tempAddress: findResult.unmatched,
          town_key: findResult.info.town_key,
          rsdt_addr_flg: findResult.info.rsdt_addr_flg,
          machiaza_id: findResult.info.machiaza_id,
          match_level: MatchLevel.MACHIAZA_DETAIL,
          matchedCnt: query.matchedCnt + findResult.depth,
          koaza: toHankakuAlphaNum(findResult.info.koaza),
          ambiguousCnt: query.ambiguousCnt + (findResult.ambiguous ? 1 : 0), 
        };
        if (findResult.info.rep_lat && findResult.info.rep_lon) {
          params.rep_lat = findResult.info.rep_lat;
          params.rep_lon = findResult.info.rep_lon;
          params.coordinate_level = MatchLevel.MACHIAZA_DETAIL;
        }
        const copied = query.copy(params);
        results.add(copied);

        anyHit = true;
      });

      if (!anyHit || anyAmbiguous) {
        results.add(query);
      }
    }

    callback(null, results);
  }
  
  private normalizeStr(address: string): string {
    // 漢数字を半角数字に変換する
    address = kan2num(address);

    // 片仮名は平仮名に変換する
    address = toHiragana(address);
    
    // JIS 第2水準 => 第1水準 及び 旧字体 => 新字体
    address = jisKanji(address);
    
    // 「丁目」をDASH に変換する
    // 大阪府堺市は「丁目」の「目」が付かないので「目?」としている
    address = address?.replaceAll(RegExpEx.create('([0-9])丁目?', 'g'), `$1${DASH}`);

    // input =「丸の内一の八」のように「ハイフン」を「の」で表現する場合があるので
    // 「の」は全部DASHに変換する
    address = address?.replaceAll(RegExpEx.create('([0-9])の', 'g'), `$1${DASH}`);
    address = address?.replaceAll(RegExpEx.create('の([0-9])', 'g'), `${DASH}$1`);

    return address;
  }
  
  private normalizeCharNode(address: CharNode | undefined): CharNode | undefined {

    let copyed = address?.clone();

    // 漢数字を半角数字に変換する
    copyed = kan2numForCharNode(copyed);

    // 片仮名は平仮名に変換する
    copyed = toHiraganaForCharNode(copyed);

    // JIS 第2水準 => 第1水準 及び 旧字体 => 新字体
    copyed = jisKanjiForCharNode(copyed);
    
    // 「丁目」をDASH に変換する
    // 大阪府堺市は「丁目」の「目」が付かないので「目?」としている
    copyed = copyed?.replaceAll(RegExpEx.create('([0-9])丁目?', 'g'), `$1${DASH}`);

    // input =「丸の内一の八」のように「ハイフン」を「の」で表現する場合があるので
    // 「の」は全部DASHに変換する
    copyed = copyed?.replaceAll(RegExpEx.create('([0-9])の', 'g'), `$1${DASH}`);
    copyed = copyed?.replaceAll(RegExpEx.create('の([0-9])', 'g'), `${DASH}$1`);

    return copyed;
  }
}
