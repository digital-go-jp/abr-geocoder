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
import { BANGAICHI, DASH, DASH_SYMBOLS, DEFAULT_FUZZY_CHAR, MUBANCHI, OAZA_BANCHO, OAZA_CENTER, SPACE, SPACE_SYMBOLS } from '@config/constant-values';
import { RegExpEx } from '@domain/services/reg-exp-ex';
import { MatchLevel } from '@domain/types/geocode/match-level';
import { SearchTarget } from '@domain/types/search-target';
import { Transform, TransformCallback } from 'node:stream';
import { Query } from '../models/query';
import { QuerySet } from '../models/query-set';
import { CharNode } from "@usecases/geocode/models/trie/char-node";

type WithScore = {
  query: Query;
  score: number;
  debug: string[];
};

export class GeocodeResultTransform extends Transform {

  private readonly matchLevelToScroe = new Map<string, number>([
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
    const addressLen = orgInput.data.address.length;

    queryList = queryList.map(query => {
      // 処理のために置き換えた文字列を元に戻す
      return this.restoreCharNode(query);
    });

    if (queryList.length === 1) {
      callback(null, queryList[0]);
      queries.clear();
      return;
    }

    // 信頼度の低い結果を取り除く
    queryList = queryList.filter(query => {
      if (query === undefined) {
        return false;
      }
      // console.error(query.formatted.score, query.formatted.address);
      // inputの文字列に対して30％以上の割合でマッチしている or
      // 市区町村が判明している
      const result = (query.formatted.score >= 0.5 ||
        (query.matchedCnt / addressLen) >= 0.3 || 
        query.match_level.num >= MatchLevel.CITY.num);
      if (!result) {
        queries.delete(query);
        query.release();
      }
      return result;
    });

    queryList = queryList.map(query => {
      if (query.city === '京都市' && query.rsdt_addr_flg !== 0) {
        query = query.copy({
          rsdt_addr_flg: 0,
        });
      }
      return query;
    });

    const withScore: WithScore[] = queryList.map(query => this.toWithScore(query));

    // スコアを降順にソート
    withScore.sort((a, b) => {
      // スコアが高い方を優先
      const diff = b.score - a.score;
      if (diff !== 0) {
        return diff;
      }
      // 2つの結果のスコアが同じだったら、マッチした文字数が長い方を採用
      // (それも一緒だったら、もうどちらでも同じとみなす)
      return b.query.matchedCnt - a.query.matchedCnt;
    });

    // targetオプションの期待に沿うように結果を返す
    // ただしallの場合、rsdt_addr_flg が間違えている可能性もあるので
    // スコアも加味する
    const {
      topRSDT,
      topParcel,
    } = this.chooseTopRSDTandParcel(withScore);
    if (!topParcel && !topRSDT) {
      callback(null, withScore[0].query);
      return;
    }

    if (!topParcel) {
      callback(null, topRSDT!.query);
      queries.clear();
      return;
    }
    if (!topRSDT) {
      callback(null, topParcel.query);
      queries.clear();
      return;
    }

    const searchTarget = queryList[0].searchTarget;
    switch (true) {
      case searchTarget === SearchTarget.ALL: {
        if (
          // RSDTのがスコアが高ければRSDTを返す
          topRSDT.score >= topParcel.score ||

          // Parcelのがスコアが高くても RSDTと差が少なければRSDTを返す
          topParcel.score - topRSDT.score <= 5
        ) {
          callback(null, topRSDT.query);
          queries.clear();
          return;
        }
        // parcelを返す
        callback(null, topParcel.query);
        queries.clear();
        return;
      }
      
      case searchTarget === SearchTarget.RESIDENTIAL: {
        // 強制的にRSDTを返す
        callback(null, topRSDT.query);
        queries.clear();
        return;
      }
      
      case searchTarget === SearchTarget.PARCEL: {
        // 強制的にPARCELを返す
        callback(null, topParcel.query);
        queries.clear();
        return;
      }
      
      default:
        throw `unexpected case`;
    }
  }
  
  private toWithScore(query: Query): any {
    const debug: string[] = [];
    
    // match_level をスコアにする
    let key = `${query.searchTarget}:${query.match_level.str}`;
    if (query.koaza_aka_code === 2) {
      // 京都通り名で Parcelになっているときは Parcelを参照
      key = `${SearchTarget.PARCEL}:${query.match_level.str}`;
    }
    const matchScore = this.matchLevelToScroe.get(key)!;
    debug.push(`match_level: ${key} -> ${matchScore}`);

    // coordinate_leve をスコアにする
    key = `${query.searchTarget}:${query.coordinate_level.str}`;
    if (query.koaza_aka_code === 2) {
      // 京都通り名で Parcelになっているときは Parcelを参照
      key = `${SearchTarget.PARCEL}:${query.coordinate_level.str}`;
    }
    const coordinateScore = this.matchLevelToScroe.get(key)!;
    debug.push(`coordinate_level: ${key} -> ${coordinateScore}`);

    // matched_cnt (多いほど良い)
    const matchedCntScore = query.matchedCnt;
    debug.push(`matchedCnt: ${matchedCntScore}`);

    // unmatched_cnt (少ないほど良い)
    const unmatchedCnt = query.unmatched.reduce((total, word) => total + word.length, 0);
    const unmatchedCntScore = query.input.data.address.length - unmatchedCnt;
    debug.push(`unmatchedCnt: ${unmatchedCntScore}`);

    // 残り文字数 (少ないほど良い)
    const remainLen = query.tempAddress?.toOriginalString().length || 0;
    const remainScore = -remainLen;
    debug.push(`remainLen: ${remainScore}`);

    // 不明瞭な文字 (少ないほど良い)
    const ambiguousScore = -query.ambiguousCnt;
    debug.push(`ambiguousCnt: ${ambiguousScore}`);

    // 類似度 (1.0になるほど良い)
    const similarScore = query.formatted.score;
    debug.push(`formatted.score: ${similarScore}`);

    // match_level と coordinate_level の差
    // (差が少ないほど良い)
    const diffScore = -Math.abs(matchScore - coordinateScore) * 2;
    debug.push(`diff of two levels: -${diffScore}`);

    const score = matchScore +
      coordinateScore +
      matchedCntScore + 
      unmatchedCntScore +
      remainScore +
      ambiguousScore +
      similarScore +
      diffScore;

    return {
      score,
      query,
      debug,
    };
  }

  private chooseTopRSDTandParcel(withScore: WithScore[]) {
    let topRSDT: WithScore | undefined;
    let topParcel: WithScore | undefined;

    for (const result of withScore) {
      if (!topRSDT && result.query.rsdt_addr_flg === 1) {
        topRSDT = result;
      }
      if (!topParcel && result.query.rsdt_addr_flg === 0) {
        topParcel = result;
      }
      if (topParcel && topRSDT) {
        break;
      }
    }
    return {
      topParcel,
      topRSDT,
    };
  }

  private restoreCharNode(query: Query): Query {

    let tempAddress: CharNode | undefined = query.tempAddress;
    tempAddress = tempAddress?.replace(RegExpEx.create(MUBANCHI), '無番地');
    tempAddress = tempAddress?.replace(RegExpEx.create(BANGAICHI), '番外地');
    tempAddress = tempAddress?.replace(RegExpEx.create(OAZA_BANCHO), '番町');
    tempAddress = tempAddress?.replace(RegExpEx.create(OAZA_CENTER), 'センター');
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
