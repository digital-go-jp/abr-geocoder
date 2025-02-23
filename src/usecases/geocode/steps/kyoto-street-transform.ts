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
import { PrefLgCode } from '@domain/types/pref-lg-code';
import { CharNode } from "@usecases/geocode/models/trie/char-node";
import { Transform, TransformCallback } from 'node:stream';
import { KyotoStreetTrieFinder } from '../models/kyoto-street-trie-finder';
import { QuerySet } from '../models/query-set';
import { Query } from '../models/query';
import { trimDashAndSpace } from '../services/trim-dash-and-space';

export class KyotoStreetTransform extends Transform {

  constructor(
    private readonly trie: KyotoStreetTrieFinder,
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
    // 通り名・大字で当たるものがあるか
    // ------------------------
    const results = new QuerySet();
    const buffer: Query[] = [];
    const KYOTO_PREF_LG_CODE = PrefLgCode.KYOTO.substring(0, 2);
    for (const query of queries.values()) {
      // 間違えてヒットする可能性もあるので、未処理のクエリもキープする
      results.add(query);

      if (query.match_level.num > MatchLevel.MACHIAZA.num) {
        // 大字以降が既に判明しているものはスキップ
        continue;
      }

      if (query.lg_code && query.lg_code.substring(0, 2) !== KYOTO_PREF_LG_CODE) {
        // 京都府以外の場合はスキップ
        continue;
      }

      if (!query.tempAddress) {
        // 探索する文字がなければスキップ
        continue;
      }

      const target = query.tempAddress.
        replaceAll(RegExpEx.create('([東西]入)る', 'g'), '$1');

      const targets: {
        target: CharNode | undefined,
        ambiguous: number;
        unused: string[];
        useKoaza: boolean;
      }[] = [
        // 全体で探す
        {
          target: target,
          ambiguous: 0,
          unused: [],
          useKoaza: true,
        },
      ];
      
      const markers = target?.
        matchAll(RegExpEx.create('(?:(?:上る|下る|東入|西入)|(?:角[東西南北])|(?:[東西南北]側))', 'g'));

      markers?.forEach(marker => {
        const koaza = query.tempAddress!.substring(0, marker.index);
        const bearingWord = query.tempAddress!.substring(marker.index, marker.lastIndex);
        const rest = query.tempAddress!.substring(marker.lastIndex);

        // 方角を省略して探す (DB内に含まれていない可能性)
        targets.push({
          target: koaza!.concat(rest),
          ambiguous: marker.lastIndex - marker.index,
          unused: [bearingWord!.toOriginalString()],
          useKoaza: true,
        });

        // 通り名 + 方角
        // targets.push({
        //   target: koaza?.concat(bearingWord),
        //   ambiguous: marker.lastIndex
        // });

        // 大字 + 方角で探す
        // targets.push({
        //   target: bearingWord?.concat(rest),
        //   ambiguous: marker.lastIndex
        // });

        // 大字だけで探す
        targets.push({
          target: rest,
          ambiguous: marker.lastIndex,
          unused: [
            koaza!.toOriginalString(),
            bearingWord!.toOriginalString(),
          ],
          useKoaza: false,
        });
      });

      // ------------------------------------
      // トライ木を使って探索
      // ------------------------------------
      targets.forEach(search => {
        if (!search.target) {
          return;
        }

        const findResults = this.trie.find({
          target: KyotoStreetTrieFinder.normalize(search.target),
          fuzzy: DEFAULT_FUZZY_CHAR,
          partialMatches: true,
          extraChallenges: ['通', '角', '東入', '西入', '上る', '下る', '角西', '角東', '北側', '南側', '東側', '西側'],
        });

        const filteredResult = findResults?.filter(result => {
          if (query.match_level === MatchLevel.UNKNOWN) {
            return true;
          }
  
          let matched = true;

          // 数字が 〇丁目にヒットしたが、次の文字が DASH でない場合はミスマッチ
          if (result.info!.oaza_cho.includes('丁目') && 
            result.unmatched !== undefined &&
            result.unmatched.char !== DASH) {
            matched = false;
          }

          if (matched && query.pref_key) {
            matched = result.info?.pref_key === query.pref_key;
          }
          if (matched && query.city_key) {
            matched = result.info?.city_key === query.city_key;
          }
          if (matched && query.oaza_cho) {
            matched = result.info?.oaza_cho === query.oaza_cho;
          }
          return matched;
        });

        // console.log(search.target?.toProcessedString(), '->', filteredResult?.length);
        if (!filteredResult || filteredResult.length === 0) {
          return;
        }
        filteredResult.forEach(result => {
          let matchedCnt = query.matchedCnt + result.depth;
          let unmatched = result.unmatched;
          if (result.info?.oaza_cho.includes('丁目') || result.info?.chome.includes('丁目')) {
            unmatched = trimDashAndSpace(unmatched);
            matchedCnt++;
          }
          //console.log(result.depth, ",", result.info?.oaza_cho, ",", result.info?.chome, ",", result.info?.koaza, "    ", result.unmatched?.toProcessedString());
          // 小字(通り名)がヒットした
          const params: Record<string, CharNode | number | string | MatchLevel | undefined> = {
            tempAddress: unmatched,
            match_level: result.info?.match_level,
            town_key: result.info!.town_key,
            city: result.info!.city,
            pref: result.info!.pref,
            city_key: result.info!.city_key,
            pref_key: result.info!.pref_key,
            rsdt_addr_flg: result.info!.rsdt_addr_flg,
            original_rsdt_addr_flg: result.info!.rsdt_addr_flg,
            oaza_cho: result.info!.oaza_cho,
            chome: result.info!.chome,
            ward: result.info!.ward,
            lg_code: result.info!.lg_code,
            koaza: result.info!.koaza,
            koaza_aka_code: result.info?.koaza_aka_code,
            machiaza_id: result.info!.machiaza_id,
            matchedCnt,
            ambiguousCnt: query.ambiguousCnt + result.ambiguousCnt + search.ambiguous,
          };
          if (result.info!.rep_lat && result.info!.rep_lon) {
            params.coordinate_level = result.info?.coordinate_level;
            params.rep_lat = result.info!.rep_lat;
            params.rep_lon = result.info!.rep_lon;
          }
          // if (!search.useKoaza) {
          //   params.match_level = MatchLevel.MACHIAZA;
          //   params.machiaza_id = result.info!.machiaza_id.substring(0, 4) + '000';
          //   params.koaza = undefined;
          // }

          const copied = query.copy(params);
          buffer.push(copied);
          if (search.unused.length > 0) {
            copied.unmatched?.push(...search.unused);
          }
        });
      });
    }

    // 最もスコアが高い結果を採用する(入力文字列と整形された文字列が似ている結果を採用する)
    buffer.sort((a, b) => b.formatted.score - a.formatted.score);
    let i = 0;
    while (i < buffer.length && buffer[0].formatted.score - buffer[i].formatted.score < 5) {
      results.add(buffer[i]);
      i++;
    }
    callback(null, results);
  }
}
