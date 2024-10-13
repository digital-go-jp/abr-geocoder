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
import { MatchLevel } from '@domain/types/geocode/match-level';
import { PrefLgCode } from '@domain/types/pref-lg-code';
import { CharNode } from "@usecases/geocode/models/trie/char-node";
import { Transform, TransformCallback } from 'node:stream';
import { KyotoStreetTrieFinder } from '../models/kyoto-street-trie-finder';
import { QuerySet } from '../models/query-set';
import { trimDashAndSpace } from '../services/trim-dash-and-space';
import { RegExpEx } from '@domain/services/reg-exp-ex';
import { Query } from '../models/query';

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
    const KYOTO_PREF_LG_CODE = PrefLgCode.KYOTO.substring(0, 2);
    for await (const query of queries.values()) {
      if (query.match_level.num > MatchLevel.MACHIAZA.num) {
        // 大字以降が既に判明しているものはスキップ
        results.add(query);
        continue;
      }

      if (query.match_level.num === MatchLevel.CITY.num &&
          query.lg_code?.substring(0, 2) !== KYOTO_PREF_LG_CODE) {
        // 京都府以外の場合はスキップ
        results.add(query);
        continue;
      }

      if (!query.tempAddress) {
        // 探索する文字がなければスキップ
        results.add(query);
        continue;
      }

      const targets: {
        target: CharNode | undefined,
        ambiguous: number;
      }[] = [
        // 全体で探す
        {
          target: query.tempAddress,
          ambiguous: 0,
        },
      ];


      const marker = query.tempAddress.match(RegExpEx.create('(?:上|下|東入|西入)る?'));
      if (marker) {
        const koaza = query.tempAddress.substring(0, marker.index);
        const bearingWord = query.tempAddress.substring(marker.index, marker.lastIndex);
        const rest = query.tempAddress.substring(marker.lastIndex);

        // 上る|下る|西入|東入を省略して探す (DB内に含まれていない可能性)
        targets.push({
          target: koaza!.concat(rest),
          ambiguous: marker.lastIndex - marker.index,
        });

        // // 大字だけで探す
        // targets.push({
        //   target: rest,
        //   ambiguous: marker.lastIndex
        // });

        // // 大字 + 方角で探す
        // targets.push({
        //   target: bearingWord?.concat(rest),
        //   ambiguous: marker.lastIndex
        // });

        // restに方角が含まれていたら削除
        targets.push({
          target: koaza!.concat(bearingWord, rest?.replace(RegExpEx.create('^[東西南北]側'), '')),
          ambiguous: marker.lastIndex - marker.index,
        });

        // 上る|下る|西入|東入を省略 & restに方角が含まれていたら削除
        targets.push({
          target: koaza!.concat(rest?.replace(RegExpEx.create('^[東西南北]側'), '')),
          ambiguous: marker.lastIndex - marker.index,
        });

        // // 大字だけで探す & restに方角が含まれていたら削除
        // targets.push({
        //   target: bearingWord?.concat(rest?.replace(RegExpEx.create('^[東西南北]側'), '')),
        //   ambiguous: marker.lastIndex
        // });
      }
 

      // ------------------------------------
      // トライ木を使って探索
      // ------------------------------------
      
      let anyHit = false;
      for (const search of targets) {
        const findResults = this.trie.find({
          target: search.target!,
          fuzzy: DEFAULT_FUZZY_CHAR,
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
          return matched;
        });

        if (!findResults || findResults.length === 0) {
          continue;
        }
        filteredResult?.forEach(result => {

          // 小字(通り名)がヒットした
          const params: Record<string, CharNode | number | string | MatchLevel> = {
            tempAddress: result.unmatched,
            match_level: MatchLevel.MACHIAZA_DETAIL,
            town_key: result.info!.town_key,
            city: result.info!.city,
            pref: result.info!.pref,
            city_key: result.info!.city_key,
            pref_key: result.info!.pref_key,
            rsdt_addr_flg: result.info!.rsdt_addr_flg,
            oaza_cho: result.info!.oaza_cho,
            chome: result.info!.chome,
            ward: result.info!.ward,
            lg_code: result.info!.lg_code,
            koaza: result.info!.koaza,
            koaza_aka_code: 2,
            machiaza_id: result.info!.machiaza_id,
            matchedCnt: query.matchedCnt + result.depth,
            ambiguousCnt: query.ambiguousCnt + (result.ambiguous ? 1 : 0) + search.ambiguous,
          };
          if (result.info!.rep_lat && result.info!.rep_lon) {
            params.coordinate_level = MatchLevel.MACHIAZA_DETAIL;
            params.rep_lat = result.info!.rep_lat;
            params.rep_lon = result.info!.rep_lon;
          }

          const copied = query.copy(params);
          results.add(copied);
          anyHit = true;
        });
      }

      if (!anyHit) {
        results.add(query);
      }
    }

    callback(null, results);
  }
}
