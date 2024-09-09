/*!
 * MIT License
 *
 * Copyright (c) 2024 デジタル庁
 * Copyright (c) 2024 NEKOYASAN
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
import {Query} from "@usecases/geocode/models/query";
import {
    DASH,
    DASH_SYMBOLS,
    DEFAULT_FUZZY_CHAR,
    MUBANCHI,
    SPACE,
    SPACE_SYMBOLS,
    VIRTUAL_SPACE
} from "@config/constant-values";
import {RegExpEx} from "@domain/services/reg-exp-ex";
import {CharNode} from "@usecases/geocode/services/trie/char-node";
import {MatchLevel} from "@domain/types/geocode/match-level";

const restoreCharNode = (query: Query): Query => {
    let result: string = (query.tempAddress?.toOriginalString() || '');

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

    // 末尾が省略可能な記号”だけ”なら削除
    result = result.replace(RegExpEx.create('^(号|番|番地|地番)$'), '');

    // もとに戻す
    result = result.replaceAll(RegExpEx.create(VIRTUAL_SPACE, 'g'), '');
    result = result.replaceAll(RegExpEx.create(DASH, 'g'), '-');
    result = result.replaceAll(RegExpEx.create(SPACE, 'g'), ' ');
    result = result.replace(RegExpEx.create(MUBANCHI), '無番地');

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

export const geocodeResultTransform = async (queries: Query[]): Promise<Query> => {

    const orgInput = queries[0].input;
    const N = orgInput.data.address.length;

    queries = queries.map(query => {
        // 処理のために置き換えた文字列を元に戻す
        return restoreCharNode(query);
    });

    // 信頼度の低い結果を取り除く
    queries = queries.filter(query => {
        if (query === undefined) {
            return false;
        }
        // inputの文字列に対して30％以上の割合でマッチしている or
        // 市区町村が判明している
        return (query.formatted.score >= 0.5 ||
            (query.matchedCnt / N) >= 0.3 ||
            query.match_level.num >= MatchLevel.CITY.num);
    });

    queries.sort((a, b) => {
        // いくつかの項目を比較して、合計値の高い方を優先する
        let totalScoreA = 0;
        let totalScoreB = 0;

        const aLv = a.match_level.num;
        const bLv = b.match_level.num;
        const isArsdt = aLv === MatchLevel.RESIDENTIAL_BLOCK.num || aLv === MatchLevel.RESIDENTIAL_DETAIL.num;
        const isBrsdt = bLv === MatchLevel.RESIDENTIAL_BLOCK.num || bLv === MatchLevel.RESIDENTIAL_DETAIL.num;
        const isAprcl = aLv === MatchLevel.PARCEL.num;
        const isBprcl = bLv === MatchLevel.PARCEL.num;

        switch (true) {
            // Aが住居表示、Bが地番の場合、住居表示を優先
            case isArsdt && isBprcl:
                totalScoreA += 1;
                break

            // Aが地番、Bが住居表示の場合、住居表示を優先
            case isAprcl && isBrsdt:
                totalScoreB += 1;
                break;

            default:
                if (a.match_level.num > b.match_level.num) {
                    totalScoreA += 1;
                } else if (a.match_level.num < b.match_level.num) {
                    totalScoreB += 1;
                }
                break;
        }


        // 元の文字と類似度が高い方に+1
        if (a.formatted.score > b.formatted.score) {
            totalScoreA += 1;
        } else if (a.formatted.score < b.formatted.score) {
            totalScoreB += 1;
        }

        // マッチングした文字列が多い方に+1
        const aMatchedCnt = a.matchedCnt - a.ambiguousCnt;
        const bMatchedCnt = b.matchedCnt - b.ambiguousCnt;
        if (aMatchedCnt > bMatchedCnt) {
            totalScoreA += 1;
        } else if (aMatchedCnt < bMatchedCnt) {
            totalScoreB += 1;
        }

        // 残り文字数が少ないほうに+1
        const restA = a.tempAddress?.toString().length || 0;
        const restB = b.tempAddress?.toString().length || 0;
        if (restA < restB) {
            totalScoreA += 1;
        } else if (restA > restB) {
            totalScoreB += 1;
        }

        // マッチレベルが高いほうが優先
        if (totalScoreB - totalScoreA !== 0) {
            return totalScoreB - totalScoreA;
        }

        // どうしても同じなら、ambiguousCnt が少ない方を優先
        if (a.ambiguousCnt < b.ambiguousCnt) {
            return -1;
        } else if (a.ambiguousCnt > b.ambiguousCnt) {
            return 1;
        }
        return 0;
    });

    if (queries.length === 0) {
        queries.push(Query.create(orgInput));
    }
    return queries[0];
}
