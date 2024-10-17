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
import { BANGAICHI, DASH, DASH_SYMBOLS, DEFAULT_FUZZY_CHAR, MUBANCHI, OAZA_BANCHO, SPACE, SPACE_SYMBOLS } from '@config/constant-values';
import { RegExpEx } from '@domain/services/reg-exp-ex';
import { MatchLevel } from '@domain/types/geocode/match-level';
import { SearchTarget } from '@domain/types/search-target';
import { Transform, TransformCallback } from 'node:stream';
import { Query } from '../models/query';
import { QuerySet } from '../models/query-set';
import { CharNode } from "@usecases/geocode/models/trie/char-node";

export class GeocodeResultTransform extends Transform {

  constructor() {
    super({
      objectMode: true,
    });
  }
  
  async _transform(
    queries: QuerySet,
    _: BufferEncoding,
    callback: TransformCallback,
  ) {
    let queryList = Array.from(queries.values());
    const orgInput = queryList[0].input;
    const N = orgInput.data.address.length;

    queryList = queryList.map(query => {
      // 処理のために置き換えた文字列を元に戻す
      return this.restoreCharNode(query);
    });

    // 信頼度の低い結果を取り除く
    queryList = queryList.filter(query => {
      if (query === undefined) {
        return false;
      }
      // console.error(query.formatted.score, query.formatted.address);
      // inputの文字列に対して30％以上の割合でマッチしている or
      // 市区町村が判明している
      return (query.formatted.score >= 0.5 ||
        (query.matchedCnt / N) >= 0.3 || 
        query.match_level.num >= MatchLevel.CITY.num);
    });

    queryList = queryList.map(query => {
      if (query.city === '京都市') {
        if (query.rsdt_addr_flg !== 0) {
          query = query.copy({
            rsdt_addr_flg: 0,
          });
        }
        return query;
      }
      return query;
    });

    const searchTarget = queryList[0].searchTarget;
    queryList.sort((a, b) => {
      // いくつかの項目を比較して、合計値の高い方を優先する
      let totalScoreA = 0;
      let totalScoreB = 0;

      const aLv = a.match_level.num;
      const bLv = b.match_level.num;
      const isArsdt = aLv === MatchLevel.RESIDENTIAL_BLOCK.num || aLv === MatchLevel.RESIDENTIAL_DETAIL.num || a.rsdt_addr_flg === 1;
      const isBrsdt = bLv === MatchLevel.RESIDENTIAL_BLOCK.num || bLv === MatchLevel.RESIDENTIAL_DETAIL.num || b.rsdt_addr_flg === 1;
      const isAprcl = aLv === MatchLevel.PARCEL.num || a.rsdt_addr_flg === 0;
      const isBprcl = bLv === MatchLevel.PARCEL.num || b.rsdt_addr_flg === 0;

      if (a.match_level === MatchLevel.UNKNOWN) {
        totalScoreA -= 100;
      }
      if (b.match_level === MatchLevel.UNKNOWN) {
        totalScoreB -= 100;
      }

      switch (true) {
        // SearchTarget.ALL のとき、Aが住居表示、Bが地番の場合、住居表示を優先
        case searchTarget === SearchTarget.ALL && isArsdt && isBprcl:
          totalScoreA += 2;
          break;

        // SearchTarget.RESIDENTIAL のとき、Aが住居表示、Bが地番の場合、住居表示を優先
        case searchTarget === SearchTarget.RESIDENTIAL && isArsdt && isBprcl:
          totalScoreA += 2;
          break;

        // SearchTarget.ALL のとき、Aが地番、Bが住居表示の場合、住居表示を優先
        case searchTarget === SearchTarget.ALL && isAprcl && isBrsdt:
          totalScoreB += 2;
          break;

        // SearchTarget.RESIDENTIAL のとき、Aが地番、Bが住居表示の場合、住居表示を優先
        case searchTarget === SearchTarget.RESIDENTIAL && isAprcl && isBrsdt:
          totalScoreB += 2;
          break;
        
        // SearchTarget.PARCEL のとき、Aが地番、Bが住居表示の場合、地番を優先
        case (searchTarget === SearchTarget.PARCEL) && isAprcl && isBrsdt:
          totalScoreA += 2;
          break;

        // SearchTarget.PARCEL のとき、Aが住居表示、Bが地番の場合、地番を優先
        case (searchTarget === SearchTarget.PARCEL) && isArsdt && isBprcl:
          totalScoreB += 2;
          break;

        default:
        // if (a.match_level.num > b.match_level.num) {
        //   totalScoreA += 1;
        // } else if (a.match_level.num < b.match_level.num) {
        //   totalScoreB += 1;
        // }
          break;
      }

      // 元の文字と類似度が高い方に+1
      if (a.formatted.score > b.formatted.score) {
        totalScoreA += 1;
      } else if (a.formatted.score < b.formatted.score) {
        totalScoreB += 1;
      }
      
      // マッチングした文字列が多い方に+1
      if (a.matchedCnt > b.matchedCnt) {
        totalScoreA += 1;
      } else if (a.matchedCnt < b.matchedCnt) {
        totalScoreB += 1;
      }

      // 残り文字数が少ないほうに+1
      const restA = a.tempAddress?.toProcessedString().length || 0;
      const restB = b.tempAddress?.toProcessedString().length || 0;
      if (restA < restB) {
        totalScoreA += 1;
      } else if (restA > restB) {
        totalScoreB += 1;
      }

      // unmatchedが少ないほうに+1
      const unmatchedA = a.unmatched.length;
      const unmatchedB = b.unmatched.length;
      if (unmatchedA < unmatchedB) {
        totalScoreA += 1;
      } else if (unmatchedA > unmatchedB) {
        totalScoreB += 1;
      }
      
      if (isAprcl && isBprcl || isArsdt && isBrsdt) {
        // 精度が高い方に+1
        if (a.match_level.num < b.match_level.num) {
          totalScoreB += 1;
        } else if (a.match_level.num > b.match_level.num) {
          totalScoreA += 1;
        }
        // 緯度経度の精度が高い方に+1
        if (a.coordinate_level.num < b.coordinate_level.num) {
          totalScoreB += 1;
        } else if (a.coordinate_level.num > b.coordinate_level.num) {
          totalScoreA += 1;
        }
        // switch (true) {
        //   case a.coordinate_level.num <= MatchLevel.MACHIAZA_DETAIL.num &&
        //     b.coordinate_level.num <= MatchLevel.MACHIAZA_DETAIL.num: {
            
        //     if (a.coordinate_level.num < b.coordinate_level.num) {
        //       totalScoreB += 1;
        //     } else if (a.coordinate_level.num > b.coordinate_level.num) {
        //       totalScoreA += 1;
        //     }
        //     break;
        //   }

        //   case a.coordinate_level.num <= MatchLevel.MACHIAZA_DETAIL.num &&
        //     b.coordinate_level.num > MatchLevel.MACHIAZA_DETAIL.num: {
        //       totalScoreB += 1;
        //     break;
        //   }

        //   case a.coordinate_level.num > MatchLevel.MACHIAZA_DETAIL.num &&
        //     b.coordinate_level.num <= MatchLevel.MACHIAZA_DETAIL.num: {
        //       totalScoreA += 1;
        //     break;
        //   }

        //   default:
        //     // Do nothing here
        //     break;
        // }
      }

      // ambiguousCnt が少ない方を優先
      if (a.ambiguousCnt < b.ambiguousCnt) {
        totalScoreA += 1;
      } else if (a.ambiguousCnt > b.ambiguousCnt) {
        totalScoreB += 1;
      }
 
      // マッチレベルが高いほうが優先
      return totalScoreB - totalScoreA;
    });
    
    if (queryList.length === 0) {
      queryList.push(Query.create(orgInput));
    }

    callback(null, queryList[0]);
  }

  private restoreCharNode(query: Query): Query {

    let tempAddress: CharNode | undefined = query.tempAddress;
    tempAddress = tempAddress?.replace(RegExpEx.create(MUBANCHI), '無番地');
    tempAddress = tempAddress?.replace(RegExpEx.create(BANGAICHI), '番外地');
    tempAddress = tempAddress?.replace(RegExpEx.create(OAZA_BANCHO), '番町');
    let result: string = (tempAddress?.toOriginalString() || '');

    // 最初の空白文字、または末尾までの間に
    // result = result.replace(RegExpEx.create(`^([^${SPACE_SYMBOLS}]+)`, 'g'), (match: string) => {
    //   // 「〇〇号」「〇〇丁目」などがあれば、数字だけにする
    //   return match
    //   .replace(
    //     RegExpEx.create(`(${DASH}?\\d+)?[(?:丁目?)(?:番地?)号]`, 'g'), `\$1${DASH}`);
    // })

    // fuzzy を元に戻す
    if (query.fuzzy) {
      result = result.replaceAll(DEFAULT_FUZZY_CHAR, query.fuzzy);
    }
    
    // 末尾が(DASH)+(空白)なら削除
    result = result.replace(RegExpEx.create(`[${DASH}${SPACE_SYMBOLS}]+$`), '');

    // 末尾が省略可能な記号なら削除
    result = result.replace(RegExpEx.create('^(?:号|番地|地番|番|地割)$'), '');
    result = result.replace(RegExpEx.create('^(?:号|番地|地番|番|地割) '), '');
    result = result.replace(RegExpEx.create('^(?:号|番地|地番|番)([0-9])', 'g'), `${DASH}$1`);
    if (query.koaza?.endsWith('地割') && result.startsWith('地割')) {
      result = result.substring(2);
    }
    
    // 先頭が省略可能な記号ならハイフンにする
    result = result.replace(RegExpEx.create('^(?:番地の?|地番|番の?|の|之|丿|ノ|-)([0-9])'), `${DASH}$1`);
    result = result.replace(RegExpEx.create('^(?:号|番地|地番|番)(?![室棟区館階]|外地)'), '');
      
    // 末尾が省略可能な記号”だけ”なら削除
    result = result.replace(RegExpEx.create('([0-9])(?:号|番地|地番|地割|番|の|之|丿|ノ|-)([0-9])'), `$1${DASH}$2`);

    // もとに戻す
    result = result.replaceAll(RegExpEx.create(DASH, 'g'), '-');
    result = result.replaceAll(RegExpEx.create(SPACE, 'g'), ' ');

    // ダッシュ記号は、半角ハイフンに統一
    // ただし「トーヨーハイツ」のように建物名にハイフンが含まれる場合もあるので、
    //「ー９０９号室」のように、「ハイフン+(数字)」で始まるか、
    //「３ー１５」のように「(数字)ー(数字)」のパターンのときだけ
    // 全角ハイフンを半角ハイフンにする
    result = result.replace(RegExpEx.create(`^[${DASH_SYMBOLS}]([0-9])`, 'g'), '-$1');
    result = result.replaceAll(RegExpEx.create(`([0-9])[${DASH_SYMBOLS}]([0-9])`, 'g'), '$1-$2');
    
    return query.copy({
      tempAddress: CharNode.create(result),
    });
  }
}
