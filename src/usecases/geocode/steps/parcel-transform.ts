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
import { TableKeyProvider } from '@domain/services/table-key-provider';
import { MatchLevel } from '@domain/types/geocode/match-level';
import { SearchTarget } from '@domain/types/search-target';
import { Transform, TransformCallback } from 'node:stream';
import { Query } from '../models/query';
import { CharNode } from '../services/trie/char-node';
import { GeocodeDbController } from '@interface/database/geocode-db-controller';
import { IParcelDbGeocode } from '@interface/database/common-db';
import { DebugLogger } from '@domain/services/logger/debug-logger';
import { QuerySet } from '../models/query-set';
import { RegExpEx } from '@domain/services/reg-exp-ex';
import { isDigitForCharNode } from '../services/is-number';
import { trimDashAndSpace } from '../services/trim-dash-and-space';

export class ParcelTransform extends Transform {

  constructor(private readonly params: Required<{
    dbCtrl: GeocodeDbController;
    logger: DebugLogger | undefined;
  }>) {
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
    //
    // 地域によっては、town.rsdt_addr_flg = 1 でも
    // parcelテーブルにデータが含まれている場合もある。
    // なので、parcelテーブルを探して、完全一致しない場合は、rsdt_blk,rsdtdsp_rsdtテーブルを探す
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
      if (query.rsdt_addr_flg !== 0) {
        results.add(query);
        continue;
      }
      
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
      const db: IParcelDbGeocode | null = await this.params.dbCtrl.openParcelDb({
        lg_code: query.lg_code,
        createIfNotExists: false,
      });
      if (!db) {
        // DBをオープンできなければスキップ
        results.add(query);
        continue;
      }

      let anyHit = false;
      const searchInfo = this.getPrcId(query);
      if (searchInfo) {
        // city_key, town_key で指定した地番情報を取得
        const findResults = await db.getParcelRows({
          prc_id: searchInfo.parcel_key,
          city_key: TableKeyProvider.getCityKey({
            lg_code: query.lg_code,
          }),
          town_key: TableKeyProvider.getTownKey({
            machiaza_id: query.machiaza_id,
            lg_code: query.lg_code,
          }),
        });

        if (findResults.length > 0) {
          anyHit = true;
          findResults.forEach(row => {
            const params: Record<string, CharNode | number | string | MatchLevel | undefined> = {
              parcel_key: row.parcel_key,
              prc_id: row.prc_id,
              prc_num1: row.prc_num1,
              prc_num2: row.prc_num2,
              prc_num3: row.prc_num3,
              tempAddress: searchInfo.unmatched,
              match_level: MatchLevel.PARCEL,
              matchedCnt: query.matchedCnt + searchInfo.matchedCnt,
            };
            if (row.rep_lat && row.rep_lon) {
              params.coordinate_level = MatchLevel.PARCEL;
              params.rep_lat = row.rep_lat;
              params.rep_lon = row.rep_lon;
            }
            const copied = query.copy(params);
            results.add(copied);
          });
        }
      }
      const searchInfo2 = this.getPrcIdWithNum1(query);
      if (searchInfo2) {
        // city_key, town_key で指定した地番情報を取得
        const findResults = await db.getParcelRows({
          prc_id: searchInfo2.parcel_key,
          city_key: TableKeyProvider.getCityKey({
            lg_code: query.lg_code,
          }),
          town_key: TableKeyProvider.getTownKey({
            machiaza_id: query.machiaza_id,
            lg_code: query.lg_code,
          }),
        });

        if (findResults.length > 0) {
          anyHit = true;
          findResults.forEach(row => {
            const params: Record<string, CharNode | number | string | MatchLevel | undefined> = {
              parcel_key: row.parcel_key,
              prc_id: row.prc_id,
              prc_num1: row.prc_num1,
              prc_num2: row.prc_num2,
              prc_num3: row.prc_num3,
              tempAddress: searchInfo2.unmatched,
              match_level: MatchLevel.PARCEL,
              matchedCnt: query.matchedCnt + searchInfo2.matchedCnt,
            };
            if (row.rep_lat && row.rep_lon) {
              params.coordinate_level = MatchLevel.PARCEL;
              params.rep_lat = row.rep_lat;
              params.rep_lon = row.rep_lon;
            }
            const copied = query.copy(params);
            results.add(copied);
          });
        }
      }
      
      if (!anyHit) {
        results.add(query);
      }
    }

    // this.params.logger?.info(`parcel : ${((Date.now() - results[0].startTime) / 1000).toFixed(2)} s`);
    callback(null, results);
  }

  // トライ木の作成に時間がかかるので、SQLの LIKE 演算子を使って
  // DB内を直接検索するための prc_id を作成する
  // fuzzyが含まれる可能性があるので、'_' に置換する
  // ('_'は、SQLiteにおいて、任意の一文字を示す)
  private getPrcId(query: Query) {
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
    while (head && !head.ignore) {
      matchedCnt++;
      if (head.char === DEFAULT_FUZZY_CHAR) {
        // fuzzyの場合、任意の１文字
        // TODO: Databaseごとの処理
        current.push('_');
      } else if (/\d/.test(head.char!)) {
        // 数字の後ろの文字をチェック
        // SPACE, DASH, 漢数字、または終了なら、追加する
        const tmpBuffer: string[] = [];
        let pointer: CharNode | undefined = head;
        while (pointer && isDigitForCharNode(pointer) && !pointer.ignore) {
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

    // prc_idは prc_num1, prc_num2, prc_num3を
    // 5桁ずつの数字（Zero fill) して結合したもの
    for (let i = buffer.length; i < 3; i++) {
      buffer.push(ZERO_FILL);
    }
    const parcelKey = buffer.join('');

    let unmatched: CharNode | undefined = head;
    if (after.length > 0) {
      unmatched = CharNode.joinWith(new CharNode({
        char: SPACE,
      }), unmatched, ...after)
    }

    return {
      parcel_key: parcelKey,
      unmatched,
      matchedCnt,
    };
  }

  private getPrcIdWithNum1(query: Query) {
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
    while (head && !head.ignore) {
      if (buffer.length > 0) {
        break;
      }
      matchedCnt++;
      if (head.char === DEFAULT_FUZZY_CHAR) {
        // fuzzyの場合、任意の１文字
        // TODO: Databaseごとの処理
        current.push('_');
      } else if (/\d/.test(head.char!)) {
        // 数字の後ろの文字をチェック
        // SPACE, DASH, 漢数字、または終了なら、追加する
        const tmpBuffer: string[] = [];
        let pointer: CharNode | undefined = head;
        while (pointer && isDigitForCharNode(pointer) && !pointer.ignore) {
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
        break;
      } else if (head.char === DASH) {
        buffer.push(current.join('').padStart(PARCEL_LENGTH, '0'));
        break;
      } else {
        break;
      }
      head = head?.next;
    }
    // if (current.length > 0) {
    //   buffer.push(current.join('').padStart(PARCEL_LENGTH, '0'));
    // }

    // prc_idは prc_num1, prc_num2, prc_num3を
    // 5桁ずつの数字（Zero fill) して結合したもの
    for (let i = buffer.length; i < 3; i++) {
      buffer.push(ZERO_FILL);
    }
    const parcelKey = buffer.join('');
    let unmatched: CharNode | undefined = head;
    if (after.length > 0) {
      unmatched = CharNode.joinWith(new CharNode({
        char: SPACE,
      }), unmatched, ...after)
    }

    return {
      parcel_key: parcelKey,
      unmatched,
      matchedCnt,
    };
  }
}
