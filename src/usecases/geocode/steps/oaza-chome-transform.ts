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
import { AMBIGUOUS_RSDT_ADDR_FLG, DASH, DEFAULT_FUZZY_CHAR, MUBANCHI, OAZA_BANCHO } from '@config/constant-values';
import { DebugLogger } from '@domain/services/logger/debug-logger';
import { RegExpEx } from '@domain/services/reg-exp-ex';
import { MatchLevel } from '@domain/types/geocode/match-level';
import { OazaChoMachingInfo } from '@domain/types/geocode/oaza-cho-info';
import { Transform, TransformCallback } from 'node:stream';
import timers from 'node:timers/promises';
import { Query } from '../models/query';
import { jisKanji, jisKanjiForCharNode } from '../services/jis-kanji';
import { kan2num } from '../services/kan2num';
import { toHankakuAlphaNum, toHankakuAlphaNumForCharNode } from '../services/to-hankaku-alpha-num';
import { toHiragana, toHiraganaForCharNode } from '../services/to-hiragana';
import { CharNode } from '../services/trie/char-node';
import { TrieAddressFinder } from '../services/trie/trie-finder';
import { QuerySet } from '../models/query-set';
import { toKatakana, toKatakanaForCharNode } from '../services/to-katakana';

export class OazaChomeTransform extends Transform {

  private readonly trie: TrieAddressFinder<OazaChoMachingInfo>;
  private readonly logger: DebugLogger | undefined;
  private initialized: boolean = false;

  constructor(params: Required<{
    oazaChomes: OazaChoMachingInfo[];
    logger: DebugLogger | undefined;
  }>) {
    super({
      objectMode: true,
    });
    this.logger = params.logger;

    this.trie = new TrieAddressFinder<OazaChoMachingInfo>();
    setImmediate(() => {
      for (const oazaInfo of params.oazaChomes) {
        this.trie.append({
          key: this.normalizeStr(oazaInfo.key),
          value: oazaInfo,
        })
      }
      this.initialized = true;
    });
  }
  private createWhereCondition(query: Query): Partial<{
    pref_key: number;
    city_key: number;
    town_key: number;
  }> | undefined {
    const conditions: Partial<{
      pref_key: number;
      city_key: number;
      town_key: number;
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
    if (query.oaza_cho) {
      anyHit = true;
      conditions.town_key = query.town_key;
    }
    if (!anyHit) {
      return undefined;
    }
    return conditions;
  }

  async _transform(
    queries: QuerySet,
    _: BufferEncoding,
    callback: TransformCallback
  ) {
    // ------------------------
    // 大字・丁目・小字で当たるものがあるか
    // ------------------------
    const results = new QuerySet();
    for await (const query of queries.values()) {
      if (query.match_level.num >= MatchLevel.MACHIAZA_DETAIL.num) {
        // 大字が既に判明している場合はスキップ
        results.add(query);
        continue;
      }
      if (!query.tempAddress) {
        // 探索する文字がなければスキップ
        results.add(query);
        continue;
      }
      
      // ------------------------------------
      // 初期化が完了していない場合は待つ
      // ------------------------------------
      if (!this.initialized) {
        while (!this.initialized) {
          await timers.setTimeout(100);
        }
      }

      // ------------------------------------
      // Queryの情報を使って、条件式を作成
      // ------------------------------------
      const where = this.createWhereCondition(query);
      
      // ------------------------------------
      // トライ木を使って探索
      // ------------------------------------
      const copiedQuery = this.normalizeQuery(query);
      if (!copiedQuery.tempAddress) {
        results.add(copiedQuery);
        continue;
      }
      // 小字に数字が含まれていて、それが番地にヒットする場合がある。
      // この場合は、マッチしすぎているので、中間結果を返す必要がある。
      // partialMatches = true にすると、中間結果を含めて返す。
      //
      // target = 末広町184
      // expected = 末広町
      // wrong_matched_result = 末広町18字
      const findResults = this.trie.find({
        target: copiedQuery.tempAddress,
        partialMatches: true,

        // マッチしなかったときに、unmatchAttemptsに入っている文字列を試す。
        // 「〇〇町」の「町」が省略された入力の場合を想定
        extraChallenges: ['町'],
        fuzzy: DEFAULT_FUZZY_CHAR,
      }) || [];
      
      const filteredResult = findResults?.filter(result => {
        if (!where) {
          return true;
        }

        let matched = true;
        if (where.pref_key) {
          matched = result.info?.pref_key === where.pref_key;
        }
        if (matched && where.city_key) {
          matched = result.info?.city_key === where.city_key;
        }
        if (matched && where.town_key) {
          matched = result.info?.town_key === where.town_key;
        }
        return matched;
      })

      // 複数都道府県にヒットする可能性があるので、全て試す
      let anyHit = false;
      let anyAmbiguous = false;
      filteredResult?.forEach(findResult => {
        // step2, step3で city_key が判別している場合で
        // city_key が異なる場合はスキップ
        if ((copiedQuery.city_key !== undefined) &&
          (copiedQuery.city_key !== findResult.info?.city_key)) {
          return;
        }
        anyAmbiguous = anyAmbiguous || findResult.ambiguous;

        const info = findResult.info!;
        anyHit = true;
        if (info.rsdt_addr_flg === AMBIGUOUS_RSDT_ADDR_FLG) {
          // 大字までヒットした
          results.add(copiedQuery.copy({
            pref_key: info.pref_key,
            city_key: info.city_key,
            town_key: info.town_key,
            lg_code: info.lg_code,
            pref: info.pref,
            city: info.city,
            rep_lat: info.rep_lat,
            rep_lon: info.rep_lon,
            oaza_cho: info.oaza_cho,
            machiaza_id: info.machiaza_id,
            rsdt_addr_flg: AMBIGUOUS_RSDT_ADDR_FLG,
            tempAddress: findResult.unmatched,
            match_level: MatchLevel.MACHIAZA,
            coordinate_level: MatchLevel.CITY,
            matchedCnt: copiedQuery.matchedCnt + findResult.depth,
            ambiguousCnt: copiedQuery.ambiguousCnt + (findResult.ambiguous ? 1 : 0), 
          }));
          return;
        }

        // 小字までヒットした
        results.add(copiedQuery.copy({
          pref_key: info.pref_key,
          city_key: info.city_key,
          town_key: info.town_key,
          lg_code: info.lg_code,
          pref: info.pref,
          city: info.city,
          rep_lat: info.rep_lat,
          rep_lon: info.rep_lon,
          oaza_cho: info.oaza_cho,
          machiaza_id: info.machiaza_id,
          chome: info.chome,
          koaza: info.koaza,
          rsdt_addr_flg: info.rsdt_addr_flg,
          tempAddress: findResult.unmatched,
          match_level: MatchLevel.MACHIAZA_DETAIL,
          coordinate_level: MatchLevel.MACHIAZA_DETAIL,
          matchedCnt: copiedQuery.matchedCnt + findResult.depth,
        }));
      });

      if (!anyHit || anyAmbiguous) {
        results.add(query);
      }
    }
    // this.logger?.info(`oaza-cho : ${((Date.now() - results[0].startTime) / 1000).toFixed(2)} s`);
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
    
    // 大字が「番町」の場合があるので、置換する
    address = address?.replace(RegExpEx.create('番町', 'g'), OAZA_BANCHO);

    // 「番地」「番丁」「番街」「番」「番地の」をDASHにする
    address = address?.replace(RegExpEx.create('番[丁地街]'), DASH);
    address = address?.replace(RegExpEx.create('番[の目]'), DASH);

    // 「大字」「字」がある場合は削除する
    address = address.replace(RegExpEx.create('大?字'), '');
    
    // 「丁目」をDASH に変換する
    // 大阪府堺市は「丁目」の「目」が付かないので「目?」としている
    address = address?.replaceAll(RegExpEx.create('丁目?', 'g'), DASH);
    
    // 京都の「四条通」の「通」が省略されることがある
    // 北海道では「春光四条二丁目1-1」を「春光4-2-1-1」と表記する例がある
    // 「条」「条通」「条通り」を DASH にする
    address = address.replace(RegExpEx.create(`([0-9]+)(?:条|条通|条通り)`, 'g'), `$1${DASH}`);

    // 第1地割　→　1地割　と書くこともあるので、「1(DASH)」にする
    // 第1地区、1丁目、1号、1部、1番地、第1なども同様。
    // トライ木でマッチすれば良いだけなので、正確である必要性はない
    address = address.replaceAll(RegExpEx.create('第?([0-9]+)(?:地[割区]|番[地丁]?|軒|号|部|条通?|字)(?![室棟区館階])', 'g'), `$1${DASH}`);

    // 北海道に「太田五の通り」という大字がある。DASHにする
    address = address?.replace(RegExpEx.create('の通り?'), DASH);
    address = address?.replace(RegExpEx.create('通り'), DASH);

    // 「〇〇町」の「町」が省略されることがあるので、、削除しておく　→ どうもこれ、うまく機能しない。別の方法を考える
    // address = address.replace(RegExpEx.create('(.{2,})町'), '$1');

    // input =「丸の内一の八」のように「ハイフン」を「の」で表現する場合があるので
    // 「の」は全部DASHに変換する
    address = address?.replaceAll(RegExpEx.create('([0-9])の', 'g'), `$1${DASH}`);
    address = address?.replaceAll(RegExpEx.create('の([0-9])', 'g'), `${DASH}$1`);
    address = address?.replaceAll(RegExpEx.create('之', 'g'), DASH);
    
    return address;
  }
  private normalizeQuery(query: Query): Query {

    let address: CharNode | undefined = query.tempAddress?.trimWith(DASH);

    // JIS 第2水準 => 第1水準 及び 旧字体 => 新字体
    // address = jisKanjiForCharNode(address);

    // // 全角英数字は、半角英数字に変換
    // address = toHankakuAlphaNumForCharNode(address);

    // // 半角カナ・全角カナを平仮名に変換する
    // address = toHiraganaForCharNode(address);

    // // 「丁目」をDASH に変換する
    // // 大阪府堺市は「丁目」の「目」が付かないので「目?」としている
    // address = address?.replace(RegExpEx.create('番[丁地街]'), DASH);
    // address = address?.replace(RegExpEx.create('番[の目]'), DASH);

    // // 「大字」「字」がある場合は削除する
    // address = address?.replace(RegExpEx.create('大?字'), '');
    
    // // 「丁目」をDASH に変換する
    // // 大阪府堺市は「丁目」の「目」が付かないので「目?」としている
    // address = address?.replaceAll(RegExpEx.create('丁目?', 'g'), DASH);
    
    // // 京都の「四条通」の「通」が省略されることがある
    // // 北海道では「春光四条二丁目1-1」を「春光4-2-1-1」と表記する例がある
    // // 「条」「条通」「条通り」を DASH にする
    // address = address?.replace(RegExpEx.create(`([0-9]+)(?:条|条通|条通り)`, 'g'), `$1${DASH}`);
    
    // // 第1地割　→　1地割　と書くこともあるので、「1(DASH)」にする
    // // 第1地区、1丁目、1号、1部、1番地、第1なども同様。
    // // トライ木でマッチすれば良いだけなので、正確である必要性はない
    // address = address?.replaceAll(RegExpEx.create('第?([0-9]+)(?:地[割区]|番[丁地街町]?|軒|号|部|条通?|字)(?![室棟区館階])', 'g'), `$1${DASH}`);

    // // 「通り」の「り」が省略されることがあるので、「通」だけにしておく
    // address = address?.replace(RegExpEx.create('の通り?'), '通');
    // address = address?.replace(RegExpEx.create('通り'), '通');

    // // 「〇〇町」の「町」が省略されることがあるので、、削除しておく　→ どうもこれ、うまく機能しない。別の方法を考える
    // // address = address?.replace(RegExpEx.create('(.{2,})町'), '$1');

    // // input =「丸の内一の八」のように「ハイフン」を「の」で表現する場合があるので
    // // 「の」は全部DASHに変換する
    // address = address?.replaceAll(RegExpEx.create('([0-9])の', 'g'), `$1${DASH}`);
    // address = address?.replaceAll(RegExpEx.create('の([0-9])', 'g'), `${DASH}$1`);
    // address = address?.replaceAll(RegExpEx.create('之', 'g'), DASH);

    if (query.city === '福井市' && query.pref === '福井県') {
      address = address?.replaceAll(RegExpEx.create('^99', 'g'), 'つくも');
    }
    if (query.city === '海田町' && query.pref === '広島県' && query.county === '安芸郡') {
      address = address?.replaceAll(RegExpEx.create('^(南)?99町', 'g'), '\$1つくも町');
    }

    return query.copy({
      tempAddress: address,
    });
  }
}       