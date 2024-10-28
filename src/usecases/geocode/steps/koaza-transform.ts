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
import { BANGAICHI, DASH, DEFAULT_FUZZY_CHAR, MUBANCHI, SPACE } from '@config/constant-values';
import { RegExpEx } from '@domain/services/reg-exp-ex';
import { KoazaMachingInfo } from '@domain/types/geocode/koaza-info';
import { MatchLevel } from '@domain/types/geocode/match-level';
import { ICommonDbGeocode } from '@interface/database/common-db';
import { CharNode } from "@usecases/geocode/models/trie/char-node";
import { TrieAddressFinder } from "@usecases/geocode/models/trie/trie-finder";
import { Transform, TransformCallback } from 'node:stream';
import { Query } from '../models/query';
import { QuerySet } from '../models/query-set';
import { jisKanji } from '../services/jis-kanji';
import { kan2num } from '../services/kan2num';
import { toHankakuAlphaNum } from '../services/to-hankaku-alpha-num';
import { toHiragana } from '../services/to-hiragana';
import { trimDashAndSpace } from '../services/trim-dash-and-space';
import { isDigitForCharNode } from '../services/is-number';

export class KoazaTransform extends Transform {

  constructor(
    private readonly db: ICommonDbGeocode,
  ) {
    super({
      objectMode: true,
    });
  }

  private createWhereCondition(query: Query) {

    const conditions: Partial<{
      city_key: string;
      oaza_cho: string;
      chome: string;
    }> = {
      city_key: query.city_key,
    };
    // if (query.town_key) {
    //   // town_keyが判明している場合もある
    //   conditions.koaza = query.town_key;
    // }
    if (query.oaza_cho) {
      // 大字が判明している場合もある
      conditions.oaza_cho = query.oaza_cho;
    }
    if (query.chome) {
      // 丁目が判明している場合もある
      conditions.chome = query.chome;
    }
    return conditions;
  }

  _transform(
    queries: QuerySet,
    _: BufferEncoding,
    callback: TransformCallback,
  ) {
    // ----------------------------------
    // 小字を特定する
    // ----------------------------------
    const results = new QuerySet();
    Array.from(queries.values()).forEach(async query => {

      if (query.koaza_aka_code === 2) {
        // 通り名が当たっている場合はスキップ
        results.add(query);
        return;
      }
      
      // 最低限、市区町村レベルまでは分かっている必要がある
      if (query.match_level.num < MatchLevel.CITY.num) {
        results.add(query);
        return;
      }
      // 既に判明している場合はスキップ
      if (query.match_level.num >= MatchLevel.MACHIAZA_DETAIL.num) {
        results.add(query);
        return;
      }

      // 小字が判明している場合はスキップ
      if (query.town_key && query.koaza) {
        results.add(query);
        return;
      }

      if (!query.tempAddress) {
        // 探索する文字がなければスキップ
        results.add(query);
        return;
      }

      // ------------------------------------
      // Queryの情報を使って、DBから情報を取得する
      // ------------------------------------
      const conditions = this.createWhereCondition(query);
      const rows = await this.db.getKoazaRows(conditions);
  
      const trie = new TrieAddressFinder<KoazaMachingInfo>();
      for (const row of rows) {
        const key = this.normalizeStr(row.key);
        row.koaza = toHankakuAlphaNum(row.koaza);
        trie.append({
          key,
          value: row,
        });
      }

      // ------------------------------------
      // トライ木を使って探索
      // ------------------------------------
      const target = trimDashAndSpace(query.tempAddress)?.
        replace(RegExpEx.create('^([0-9]+)地割', 'g'), `$1${DASH}`);
      if (!target) {
        results.add(query);
        return;
      }
      const findResults = trie.find({
        target,
        fuzzy: DEFAULT_FUZZY_CHAR,
      });
      
      let anyHit = false;
      let anyAmbiguous = false;

      // 複数にヒットする可能性がある
      findResults?.forEach(findResult => {
        if (!findResult.info) {
          throw new Error('findResult.info is empty');
        }
        // ◯◯地割 + 数字が残った場合、ミスマッチの可能性が高い
        if (findResult.info.koaza.includes('地割') && isDigitForCharNode(findResult.unmatched)) {
          return;
        }
        anyAmbiguous = anyAmbiguous || findResult.ambiguous;

        // 小字がヒットした
        const params: Record<string, CharNode | number | string | MatchLevel | undefined> = {
          tempAddress: findResult.unmatched,
          match_level: MatchLevel.MACHIAZA_DETAIL,
          town_key: findResult.info.town_key,
          city_key: findResult.info.city_key,
          rsdt_addr_flg: findResult.info.rsdt_addr_flg,
          oaza_cho: findResult.info.oaza_cho,
          chome: findResult.info.chome,
          koaza: findResult.info.koaza,
          machiaza_id: findResult.info.machiaza_id,
          matchedCnt: query.matchedCnt + findResult.depth,
          ambiguousCnt: query.ambiguousCnt + (findResult.ambiguous ? 1 : 0), 
        };
        if (findResult.info.rep_lat && findResult.info.rep_lon) {
          params.coordinate_level = MatchLevel.MACHIAZA_DETAIL;
          params.rep_lat = findResult.info.rep_lat;
          params.rep_lon = findResult.info.rep_lon;
        }
        const copied = query.copy(params);
        results.add(copied);

        anyHit = true;
      });

      if (!anyHit || anyAmbiguous) {
        results.add(query);
      }
    });

    callback(null, results);
  }

  private normalizeStr(address: string): string {
    // 漢数字を半角数字に変換する
    address = kan2num(address);

    // 全角英数字は、半角英数字に変換
    address = toHankakuAlphaNum(address);
    
    // 片仮名は平仮名に変換する
    address = toHiragana(address);

    // JIS 第2水準 => 第1水準 及び 旧字体 => 新字体
    address = jisKanji(address);

    // 「無番地」を「MUBANCHI」にする
    address = address?.replace(RegExpEx.create('無番地'), MUBANCHI);
    
    // 「番外地」を「BANGAICHI」にする
    address = address?.replace(RegExpEx.create('番外地'), BANGAICHI);
    
    // 「丁目」をDASH に変換する
    // 大阪府堺市は「丁目」の「目」が付かないので「目?」としている
    address = address.replaceAll(RegExpEx.create('丁目?', 'g'), DASH);

    // 小字に「大字」「字」を含んでいることがあり、住居表示だと省略されることも多いので取り除く
    address = address.replace(RegExpEx.create('大?字'), '');
    
    // 第1地割 → 1地割 と書くこともあるので、「1(DASH)」にする
    // 第1地区、1丁目、1号、1部、1番地、第1なども同様。
    // トライ木でマッチすれば良いだけなので、正確である必要性はない
    address = address.replaceAll(RegExpEx.create('第?([0-9]+)(?:地[割区]|番地?|軒|号|部|条通?|字)(?![室棟区館階])', 'g'), `$1${DASH}`);

    // 「一ノ瀬」→「一の瀬」と書くこともあるので、カタカナを平仮名にする
    // address = toHiragana(address);

    // input =「丸の内一の八」のように「ハイフン」を「の」で表現する場合があるので
    // 「の」は全部DASHに変換する
    address = address?.replaceAll(RegExpEx.create('([0-9])の', 'g'), `$1${DASH}`);
    
    address = address?.replaceAll(RegExpEx.create('([0-9])の([0-9])', 'g'), `$1${DASH}$2`);

    address = address?.
      replaceAll(RegExpEx.create(`^[${SPACE}${DASH}]`, 'g'), '')?.
      replaceAll(RegExpEx.create(`[${SPACE}${DASH}]$`, 'g'), '');

    return address;
  }
}
