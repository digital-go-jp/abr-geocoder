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
import { CharNode } from "@usecases/geocode/models/trie/char-node";
import { Transform, TransformCallback } from 'node:stream';
import { OazaChoTrieFinder } from '../models/oaza-cho-trie-finder';
import { Query } from '../models/query';
import { QuerySet } from '../models/query-set';
import { isDigit } from '../services/is-number';
import { trimDashAndSpace } from '../services/trim-dash-and-space';
import { isKanjiNums } from '../services/is-kanji-nums';
import { PrefLgCode, toPrefLgCode } from '@domain/types/pref-lg-code';

export class OazaChomeTransform extends Transform {

  constructor(
    private readonly trieTrees: Map<PrefLgCode, OazaChoTrieFinder>,
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
    // 大字・丁目・小字で当たるものがあるか
    // ------------------------
    const results: QuerySet = new QuerySet();
    for (const query of queries.values()) {
      // if (query.match_level.num >= MatchLevel.MACHIAZA.num) {
      //   // 大字が既に判明している場合はスキップ
      //   results.add(query);
      //   continue;
      // }

      // 探索する文字がなければスキップ
      if (!query.tempAddress) {
        results.add(query);
        continue;
      }
      // 通り名が当たっている場合はスキップ
      if (query.koaza_aka_code === 2) {
        results.add(query);
        continue;
      }
      
      // 京都通り名の特徴がある場合はスキップ
      const bearingWord = query.tempAddress.match(RegExpEx.create('(?:(?:上る|下る|東入る?|西入る?)|(?:角[東西南北])|(?:[東西南北]側))'));
      if (bearingWord) {
        results.add(query);
        continue;
      }

      // この時点で都道府県が判別できていない場合、全都道府県を探す
      const trieTrees: OazaChoTrieFinder[] = [];
      if (!query.lg_code) {
        trieTrees.push(...Array.from(this.trieTrees.values()));
      } else {
        // 都道府県が判別できている場合は、都道府県のトライ木を使う
        const prefLgCode = toPrefLgCode(query.lg_code!);
        if (!prefLgCode || !this.trieTrees.has(prefLgCode)) {
          results.add(query);
          continue;
        }
        trieTrees.push(this.trieTrees.get(prefLgCode)!);
      }


      // ------------------------------------
      // トライ木を使って探索
      // ------------------------------------
      const copiedQuery = this.normalizeQuery(query);
      const targets = new QuerySet();
      targets.add(copiedQuery);

      // 大字が中途半端に当たっている場合がある。大字を含めて探索する
      // input: "藤野一条", oaza_cho: "藤野"
      if (query.oaza_cho) {
        let prefix = CharNode.create(query.oaza_cho);
        if (query.chome) {
          if (prefix) {
            prefix = prefix.concat(CharNode.create(query.chome))!;
          } else {
            prefix = CharNode.create(query.chome);
          }
        }
        if (prefix) {
          targets.add(copiedQuery.copy({
            oaza_cho: '',
            matchedCnt: copiedQuery.matchedCnt - prefix.toOriginalString().length,
            tempAddress: prefix.concat(copiedQuery.tempAddress),
          }));
        }
      }

      // 〇〇番町の「番町」が省略されている可能性
      if (copiedQuery.tempAddress?.includes(RegExpEx.create('([0-9])番町', 'g'))) {
        targets.add(copiedQuery.copy({
          tempAddress: copiedQuery.tempAddress.replace(RegExpEx.create('([0-9])番町', 'g'), '$1'),
        }));
      }

      // 〇〇町の「町」が省略されている可能性
      if (copiedQuery.tempAddress?.includes('町')) {
        targets.add(copiedQuery.copy({
          tempAddress: copiedQuery.tempAddress.replace('町', ''),
        }));
      }

      // 既にmachiaza以上で正しい場合、ここではヒットしないので、結果に追加しておく
      // (ただし他の可能性もあるので、targetsに対するチェックは行う)
      if (query.match_level.num >= MatchLevel.MACHIAZA.num) {
        results.add(query);
      }

      let anyHit = false;
      let anyAmbiguous = false;
      for (const trie of trieTrees) {
        trie.debug = false; // デバッグ用
        for (const targetQuery of targets.values()) {
          if (!targetQuery || !targetQuery.tempAddress) {
            continue;
          }
          // 小字に数字が含まれていて、それが番地にヒットする場合がある。
          // この場合は、マッチしすぎているので、中間結果を返す必要がある。
          // partialMatches = true にすると、中間結果を含めて返す。
          //
          // target = 末広町184
          // expected = 末広町
          // wrong_matched_result = 末広町18字
          const findResults = trie.find({
            target: targetQuery.tempAddress,
            partialMatches: true,
            fuzzy: DEFAULT_FUZZY_CHAR,
          }) || [];
          
          // ------------------------------------
          // Queryの情報を使って、条件式を作成
          // ------------------------------------
          const filteredResult = findResults?.filter(result => {
            if (result.depth === 0) {
              return false;
            }
            if (query.pref_key && result.info?.pref_key !== query.pref_key) {
              return false;
            }
            if (query.city_key && result.info?.city_key !== query.city_key) {
              return false;
            }

            // 当たった文字列(path)の最後が数字で、unmatchedの先頭が数字なら間違い
            if (isDigit(result.unmatched) ) {
              let pathTail = result.path;
              while (pathTail?.next) {
                pathTail = pathTail.next;
              }
              if (isDigit(pathTail?.char)) {
                // ただしどちらかが漢数字で、どちらかが算用数字の場合、たぶん合っている
                // (両方とも同じなら間違い)
                const isTailKanjiNum = isKanjiNums(pathTail?.originalChar);
                const isUnmatchedKanjiNum = isKanjiNums(result.unmatched?.originalChar);
                if (isTailKanjiNum === isUnmatchedKanjiNum) {
                  return false;
                }
              }
            }
            return true;
          });

          // 複数都道府県にヒットする可能性があるので、全て試す
          filteredResult?.forEach(result => {
            let ambiguousCnt = targetQuery.ambiguousCnt + result.ambiguousCnt;
            let matchedCnt = targetQuery.matchedCnt + result.depth;
            if (targetQuery.oaza_cho && targetQuery.oaza_cho !== result.info?.oaza_cho) {
              anyAmbiguous = true;
              ambiguousCnt += targetQuery.oaza_cho.length;
              return;
            }

            const info = result.info!;
            let unmatched = result.unmatched;

            if (info.chome && (info.chome.includes('丁目') || info.oaza_cho.includes('丁目')) &&
              result.unmatched?.char === DASH) {
              matchedCnt += 1;
              unmatched = trimDashAndSpace(result.unmatched);
            }
            if (info.oaza_cho && info.oaza_cho.endsWith('町') && unmatched?.char === '町') {
              unmatched = unmatched.next?.moveToNext();
              matchedCnt += 1;
            }
            if (info.chome && info.chome.endsWith('町') && unmatched?.char === '町') {
              unmatched = unmatched.next?.moveToNext();
              matchedCnt += 1;
            }

            anyHit = true;
            const params: Record<string, CharNode | number | string | MatchLevel | null | undefined> = {
              pref_key: info.pref_key,
              city_key: info.city_key,
              town_key: info.town_key,
              lg_code: info.lg_code,
              pref: info.pref,
              city: info.city,
              oaza_cho: info.oaza_cho,
              chome: info.chome,
              koaza: info.koaza,
              ward: info.ward,
              machiaza_id: info.machiaza_id,
              rsdt_addr_flg: info.rsdt_addr_flg,
              original_rsdt_addr_flg: info.rsdt_addr_flg,
              tempAddress: unmatched,
              match_level: info.match_level,
              matchedCnt,
              ambiguousCnt, 
            };
            if (info.rep_lat && info.rep_lon) {
              params.rep_lat = info.rep_lat;
              params.rep_lon = info.rep_lon;
              params.coordinate_level = info.coordinate_level;
            }
            const copied = targetQuery.copy(params);
            results.add(copied);
          });
        }
        trie.debug = false;
      }
      if (!anyHit || anyAmbiguous) {
        results.add(query);
      }
    }

    queries.clear();

    callback(null, results);
  }

  
  private normalizeQuery(query: Query): Query {

    let address: CharNode | undefined = query.tempAddress?.trimWith(DASH);

    if (query.city === '福井市' && query.pref === '福井県') {
      address = address?.replaceAll(RegExpEx.create('^99', 'g'), 'つくも');
    }
    if (query.city === '海田町' && query.pref === '広島県' && query.county === '安芸郡') {
      address = address?.replaceAll(RegExpEx.create('^(南)?99町', 'g'), '$1つくも町');
    }

    address = OazaChoTrieFinder.normalize(address);

    return query.copy({
      tempAddress: address,
    });
  }
}
