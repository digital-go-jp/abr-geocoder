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
import { DASH, KANJI_NUMS, SPACE } from '@config/constant-values';
import { RegExpEx } from '@domain/services/reg-exp-ex';
import { MatchLevel } from '@domain/types/geocode/match-level';
import { SearchTarget } from '@domain/types/search-target';
import { IParcelDbGeocode } from '@drivers/database/common-db';
import { CharNode } from "@usecases/geocode/models/trie/char-node";
import { Transform, TransformCallback } from 'node:stream';
import { AbrGeocoderDiContainer } from '../models/abr-geocoder-di-container';
import { IQuery, Query } from '../models/query';
import { QuerySet } from '../models/query-set';
import { isDigit } from '../services/is-number';
import { trimDashAndSpace } from '../services/trim-dash-and-space';
import { TableKeyProvider } from '@domain/services/table-key-provider';

export class ParcelTransform extends Transform {

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
    // 地番で当たるものがあるか
    // ------------------------

    const results = new QuerySet();
    for await (const query of queries.values()) {
      if (query.searchTarget === SearchTarget.RESIDENTIAL) {
        // 住居表示検索が指定されている場合、このステップはスキップする
        results.add(query);
        continue;
      }

      // lg_code が必要なので、CITY未満はスキップする
      if (query.match_level.num < MatchLevel.CITY.num) {
        results.add(query);
        continue;
      }

      // 住居表示実施地区の場合はスキップ
      // if (query.rsdt_addr_flg !== 0) {
      //   results.add(query);
      //   continue;
      // }
      
      // 既に住居表示で見つかっている場合もスキップ
      if (query.match_level.num === MatchLevel.RESIDENTIAL_BLOCK.num ||
        query.match_level.num === MatchLevel.RESIDENTIAL_DETAIL.num) {
        results.add(query);
        continue;
      }

      if (!query.lg_code) {
        results.add(query);
        continue;
      }
      if (!query.tempAddress) {
        // 探索する文字がなければスキップ
        results.add(query);
        continue;
      }
      const db: IParcelDbGeocode | null = await this.diContainer.database.openParcelDb({
        lg_code: query.lg_code,
        createIfNotExists: false,
      });
      if (!db) {
        // DBをオープンできなければスキップ
        results.add(query);
        continue;
      }
      const searchPatterns = [
        this.getPrcId(query, 3),
        this.getPrcId(query, 2),
        this.getPrcId(query, 1),
      ];

      // 統合した結果を作る
      let anyHit = false;
      const seen = new Set();
      const reducedParams: Partial<IQuery> = {
        matchedCnt: query.matchedCnt,
        ambiguousCnt: query.ambiguousCnt,
        tempAddress: query.tempAddress,
        parcel_key: undefined,
        prc_num1: undefined,
        prc_num2: undefined,
        prc_num3: undefined,
        match_level: query.match_level,
        coordinate_level: query.coordinate_level,
        rep_lat: query.rep_lat,
        rep_lon: query.rep_lon,
      };
      for (const queryInfo of searchPatterns) {
        if (!queryInfo) {
          continue;
        }
        if (seen.has(queryInfo.parcelId)) {
          continue;
        }
        seen.add(queryInfo.parcelId);

        const machiaza_id = this.getMachiazaId(query);

        // town_key で指定した地番情報を取得
        const findResults = await db.getParcelRows({
          town_key: TableKeyProvider.getTownKey({
            machiaza_id,
            lg_code: query.lg_code,
          }),
          prc_id: queryInfo.parcelId, 
        })
        
        findResults.forEach(info => {
          anyHit = true;
          if (reducedParams.matchedCnt! < query.matchedCnt + queryInfo.matchedCnt) {
            reducedParams.matchedCnt = query.matchedCnt + queryInfo.matchedCnt;
            reducedParams.ambiguousCnt = query.ambiguousCnt + queryInfo.ambiguousCnt;
            reducedParams.prc_num1 = info.prc_num1;
            reducedParams.prc_num2 = info.prc_num2;
            reducedParams.prc_num3 = info.prc_num3;
            reducedParams.prc_id = info.prc_id;
            reducedParams.match_level = MatchLevel.PARCEL;
            reducedParams.tempAddress = queryInfo.unmatched;
            reducedParams.rsdt_addr_flg = 0;
          }
          if (reducedParams.coordinate_level?.num !== MatchLevel.PARCEL.num && info.rep_lat) {
            reducedParams.rep_lat = info.rep_lat;
            reducedParams.rep_lon = info.rep_lon;
            reducedParams.coordinate_level = MatchLevel.PARCEL;
          }
        });
      }
      if (anyHit) {
        const copied = query.copy(reducedParams);
        results.add(copied);
      } else {
        // 何も見つからない場合は、元のクエリをキープする
        results.add(query);
      }
      db.close();
    }
    queries.clear();
    callback(null, results);
  }

  private getMachiazaId(query: Query) {
    if (query.koaza_aka_code !== 2) {
      return query.machiaza_id!;
    }

    // 京都の通り名の場合、大字のmachiaza_idを使用する
    // (通り名にも machiaza_idが割り当てられているが、parcelテーブルにはない)
    return query.machiaza_id?.substring(0, 4) + `000`;
  }

  // 〇〇-△△-☓☓ を分解して、IDを作る
  private getPrcId(query: Query, numOfParcelNums: 1 | 2 | 3) {
    const PARCEL_LENGTH = 5;
    const ZERO_FILL = ''.padStart(PARCEL_LENGTH, '0');

    const buffer: string[] = [];
    const current: string[] = [];
    const target = trimDashAndSpace(query.tempAddress);
    if (!target) {
      return;
    }

    const [before, ...after]: CharNode[] = target.split(SPACE);
    let head: CharNode | undefined = before?.trimWith(DASH);
    const kanjiNums = RegExpEx.create(`[${KANJI_NUMS}]`);

    // マッチした文字数
    let matchedCnt = 0;
    let ambiguousCnt = 0;
    while (head && !head.ignore) {
      matchedCnt++;
      if (head.char === query.fuzzy) {
        // fuzzyの場合、任意の１文字
        current.push('_'); // SQLで任意の1文字を示す
        ambiguousCnt++;
      } else if (/\d/.test(head.char!)) {
        // 数字の後ろの文字をチェック
        // SPACE, DASH, 漢数字、または終了なら、追加する
        const tmpBuffer: string[] = [];
        let pointer: CharNode | undefined = head;
        while (pointer && isDigit(pointer) && !pointer.ignore) {
          tmpBuffer.push(pointer.char!);
          pointer = pointer.next;
        }
        
        if (!pointer || pointer?.ignore || pointer.char === SPACE || kanjiNums.test(pointer.originalChar!)) {
          current.push(...tmpBuffer);
          buffer.push(current.join('').padStart(PARCEL_LENGTH, '0'));
          head = pointer;
          current.length = 0;
          matchedCnt += tmpBuffer.length;
          break;
        }
        if (pointer.char !== DASH) {
          break;
        }
        
        current.push(...tmpBuffer);
        head = pointer;
        matchedCnt += tmpBuffer.length;

        buffer.push(current.join('').padStart(PARCEL_LENGTH, '0'));
        current.length = 0;
      } else if (head.char === DASH) {
        buffer.push(current.join('').padStart(PARCEL_LENGTH, '0'));
        current.length = 0;
      } else {
        break;
      }

      // numOfParcelNumsの数値を取ったらループを抜ける
      // (〇〇番地△△　の「番地△△」を残す)
      if (buffer.length === numOfParcelNums) {
        break;
      }
      head = head?.next;
    }
    if (current.length > 0) {
      buffer.push(current.join('').padStart(PARCEL_LENGTH, '0'));
    }
    
    // prc_num1,2,3 を用意する
    for (let i = buffer.length; i < 3; i++) {
      buffer.push(ZERO_FILL);
    }
    const parcelId = buffer.join('');

    // マッチしなかった残り文字列
    let unmatched: CharNode | undefined = head;
    if (after.length > 0) {
      unmatched = CharNode.joinWith(new CharNode({
        char: SPACE,
      }), unmatched, ...after);
    }

    return {
      parcelId,
      unmatched,
      matchedCnt,
      ambiguousCnt,
    };
  }
}
