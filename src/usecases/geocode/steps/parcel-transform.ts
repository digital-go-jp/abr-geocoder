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
import { DASH, DEFAULT_FUZZY_CHAR, KANJI_NUMS, SPACE } from '@config/constant-values';
import { RegExpEx } from '@domain/services/reg-exp-ex';
import { TableKeyProvider } from '@domain/services/table-key-provider';
import { MatchLevel } from '@domain/types/geocode/match-level';
import { SearchTarget } from '@domain/types/search-target';
import { CharNode } from "@usecases/geocode/models/trie/char-node";
import { LRUCache } from "lru-cache";
import { Transform, TransformCallback } from 'node:stream';
import { AbrGeocoderDiContainer } from '../models/abr-geocoder-di-container';
import { ParcelTrieFinder } from '../models/parcel-trie-finder';
import { Query } from '../models/query';
import { QuerySet } from '../models/query-set';
import { isDigit } from '../services/is-number';
import { trimDashAndSpace } from '../services/trim-dash-and-space';

export class ParcelTransform extends Transform {

  private readonly lgCodeToBuffer: LRUCache<string, Buffer> = new LRUCache<string, Buffer>({
    max: 10,
  });
  private readonly noDbLgCode: Set<string> = new Set();

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
      

      // トライ木のデータを読み込む
      let trieData = this.lgCodeToBuffer.get(query.lg_code);
      if (!trieData) {
        trieData = await ParcelTrieFinder.loadDataFile({
          lg_code: query.lg_code,
          diContainer: this.diContainer,
        });
        this.lgCodeToBuffer.set(query.lg_code, trieData);
      }
      if (!trieData) {
        // データがなければスキップ
        results.add(query);
        this.noDbLgCode.add(query.lg_code);
        continue;
      }

      const town_key = TableKeyProvider.getTownKey({
        machiaza_id: query.machiaza_id!,
        lg_code: query.lg_code,
      });

      const finder = new ParcelTrieFinder(trieData);

      let anyHit = false;
      // 番地部分を探索する
      const searchPatterns = [
        this.getPrcId(query, 3),
        this.getPrcId(query, 2),
        this.getPrcId(query, 1),
      ];
      const seen = new Set();
      for (const queryInfo of searchPatterns) {
        if (!queryInfo) {
          continue;
        }
        if (seen.has(queryInfo.parcelId)) {
          continue;
        }
        seen.add(queryInfo.parcelId);

        // town_key で指定した地番情報を取得
        const key = `${town_key}:${queryInfo.parcelId}`;
        const findResults = finder.find({
          target: CharNode.create(key),
          fuzzy: DEFAULT_FUZZY_CHAR,
        });

        if (findResults.length === 0) {
          continue;
        }

        anyHit = true;
        findResults.forEach(result => {
          const info = result.info;
          const params: Record<string, CharNode | number | string | MatchLevel | undefined> = {
            parcel_key: info?.parcel_key,
            prc_id: info?.prc_id,
            prc_num1: info?.prc_num1,
            prc_num2: info?.prc_num2,
            prc_num3: info?.prc_num3,
            tempAddress: result.unmatched?.concat(queryInfo.unmatched) || queryInfo.unmatched,
            match_level: MatchLevel.PARCEL,
            matchedCnt: query.matchedCnt + queryInfo.matchedCnt,
            rsdt_addr_flg: 0,
          };
          if (result.info?.rep_lat && result.info?.rep_lon) {
            params.coordinate_level = MatchLevel.PARCEL;
            params.rep_lat = result.info?.rep_lat;
            params.rep_lon = result.info?.rep_lon;
          }
          const copied = query.copy(params);
          results.add(copied);
        });

        // 見つかった場合は探索終了
        break;
      }
      // 何も見つからない場合は、元のクエリをキープする
      if (!anyHit) {
        results.add(query);
      }
    }
    queries.clear();
    callback(null, results);
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
    while (head && !head.ignore && buffer.length < numOfParcelNums) {
      matchedCnt++;
      if (head.char === DEFAULT_FUZZY_CHAR) {
        // fuzzyの場合、任意の１文字
        // TODO: Databaseごとの処理
        current.push(DEFAULT_FUZZY_CHAR);
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
    };
  }
}
