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

    const matchLevelToScroe = new Map<string, number>([
      [`${SearchTarget.ALL}:${MatchLevel.UNKNOWN}`, -2],
      [`${SearchTarget.ALL}:${MatchLevel.PREFECTURE}`, 1],
      [`${SearchTarget.ALL}:${MatchLevel.CITY}`, 2],
      [`${SearchTarget.ALL}:${MatchLevel.MACHIAZA}`, 3],
      [`${SearchTarget.ALL}:${MatchLevel.MACHIAZA_DETAIL}`, 4],
      [`${SearchTarget.ALL}:${MatchLevel.RESIDENTIAL_BLOCK}`, 5],
      [`${SearchTarget.ALL}:${MatchLevel.RESIDENTIAL_DETAIL}`, 6],
      
       // rsdt_addr_flgが間違えている可能性もあるので、MACHIAZA_DETAILより僅かに上の価値、というスコアにしておく
      [`${SearchTarget.ALL}:${MatchLevel.PARCEL}`, 4.5],

      [`${SearchTarget.RESIDENTIAL}:${MatchLevel.UNKNOWN}`, -2],
      [`${SearchTarget.RESIDENTIAL}:${MatchLevel.PREFECTURE}`, 1],
      [`${SearchTarget.RESIDENTIAL}:${MatchLevel.CITY}`, 2],
      [`${SearchTarget.RESIDENTIAL}:${MatchLevel.MACHIAZA}`, 3],
      [`${SearchTarget.RESIDENTIAL}:${MatchLevel.MACHIAZA_DETAIL}`, 4],
      [`${SearchTarget.RESIDENTIAL}:${MatchLevel.RESIDENTIAL_BLOCK}`, 5],
      [`${SearchTarget.RESIDENTIAL}:${MatchLevel.RESIDENTIAL_DETAIL}`, 6],
      [`${SearchTarget.RESIDENTIAL}:${MatchLevel.PARCEL}`, -1],

      [`${SearchTarget.PARCEL}:${MatchLevel.UNKNOWN}`, -2],
      [`${SearchTarget.PARCEL}:${MatchLevel.PREFECTURE}`, 1],
      [`${SearchTarget.PARCEL}:${MatchLevel.CITY}`, 2],
      [`${SearchTarget.PARCEL}:${MatchLevel.MACHIAZA}`, 3],
      [`${SearchTarget.PARCEL}:${MatchLevel.MACHIAZA_DETAIL}`, 4],
      [`${SearchTarget.PARCEL}:${MatchLevel.RESIDENTIAL_BLOCK}`, -1],
      [`${SearchTarget.PARCEL}:${MatchLevel.RESIDENTIAL_DETAIL}`, -1],
      [`${SearchTarget.PARCEL}:${MatchLevel.PARCEL}`, 6],
    ]);

    const withScore: {
      query: Query;
      score: number;
      debug: string[];
    }[] = queryList.map(query => {
      const debug: string[] = [];
      let score = 0;
      
      // match_level をスコアにする
      let key = `${query.searchTarget}:${query.match_level.str}`;
      if (query.koaza_aka_code === 2) {
        // 京都通り名で Parcelになっているときは Parcelを参照
        key = `${SearchTarget.PARCEL}:${query.match_level.str}`;
      }
      score = matchLevelToScroe.get(key)!;
      debug.push(`match_level: ${key} -> ${score}`);

      // coordinate_leve をスコアにする
      key = `${query.searchTarget}:${query.coordinate_level.str}`;
      if (query.koaza_aka_code === 2) {
        // 京都通り名で Parcelになっているときは Parcelを参照
        key = `${SearchTarget.PARCEL}:${query.coordinate_level.str}`;
      }
      score += matchLevelToScroe.get(key)!;
      debug.push(`coordinate_level: ${key} -> ${matchLevelToScroe.get(key)!}`);

      // matched_cnt (多いほど良い)
      score += query.matchedCnt;
      debug.push(`matchedCnt: ${query.matchedCnt}`);

      // unmatched_cnt (少ないほど良い)
      const unmatchedCnt = query.unmatched.reduce((total, word) => total + word.length, 0);
      score += orgInput.data.address.length - unmatchedCnt;
      debug.push(`unmatchedCnt: ${orgInput.data.address.length - unmatchedCnt}`);

      // 残り文字数 (少ないほど良い)
      const remainLen = orgInput.data.address.length - (query.tempAddress?.toProcessedString().length || 0);
      score += remainLen;
      debug.push(`remainLen: ${remainLen}`);

      // 不明瞭な文字 (少ないほど良い)
      score -= query.ambiguousCnt;
      debug.push(`ambiguousCnt: -${query.ambiguousCnt}`);

      // 類似度 (1.0になるほど良い)
      score += query.formatted.score;
      debug.push(`formatted.score: ${query.formatted.score}`);

      // match_level と coordinate_level の差
      // (差が少ないほど良い)
      const diff = query.match_level.num - query.coordinate_level.num;
      score -= diff;
      debug.push(`diff of two levels: -${diff}`);

      return {
        score,
        query,
        debug,
      }
    });

    // スコアを降順にソート
    withScore.sort((a, b) => b.score - a.score);

    callback(null, withScore[0].query);
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
