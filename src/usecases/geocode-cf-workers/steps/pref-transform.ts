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
import {TrieAddressFinder} from "@usecases/geocode/services/trie/trie-finder";
import {PrefInfo} from "@domain/types/geocode/pref-info";
import {ICommonDbGeocode} from "@interface/database/common-db";
import {toHiragana} from "@usecases/geocode/services/to-hiragana";
import {jisKanji} from "@usecases/geocode/services/jis-kanji";
import {kan2num} from "@usecases/geocode/services/kan2num";
import {DEFAULT_FUZZY_CHAR} from "@config/constant-values";
import {MatchLevel} from "@domain/types/geocode/match-level";

const normalizeStr = (value: string): string => {
    // 半角カナ・全角カナ => 平仮名
    value = toHiragana(value);

    // JIS 第2水準 => 第1水準 及び 旧字体 => 新字体
    value = jisKanji(value);

    // 漢数字 => 算用数字
    value = kan2num(value);

    return value;
}

export const prefTransform = async (commonDbGeocode: ICommonDbGeocode, queries: Query[]): Promise<Query[]> => {
    const prefList = await commonDbGeocode.getPrefList();

    const prefTrie = new TrieAddressFinder<PrefInfo>();
    for (const prefInfo of prefList) {
        prefTrie.append({
            key: normalizeStr(prefInfo.pref),
            value: prefInfo,
        });
    }


    const results = [];
    for (const query of queries) {
        // --------------------
        // 都道府県を探索する
        // --------------------
        const matched = prefTrie.find({
            target: query.tempAddress!,

            // マッチしなかったときに、unmatchAttemptsに入っている文字列を試す。
            extraChallenges: ['道', '都', '府', '県'],

            fuzzy: DEFAULT_FUZZY_CHAR,
        });

        if (!matched) {
            results.push(query);
            break;
        }
        let anyHit = false;
        let anyAmbiguous = false;
        for (const mResult of matched) {
            if (!mResult.info) {
                continue;
            }
            anyAmbiguous = anyAmbiguous || mResult.ambiguous;
            anyHit = true;
            results.push(query.copy({
                pref_key: mResult.info.pref_key,
                tempAddress: mResult.unmatched,
                rep_lat: mResult.info.rep_lat,
                rep_lon: mResult.info.rep_lon,
                lg_code: mResult.info.lg_code,
                pref: mResult.info.pref,
                match_level: MatchLevel.PREFECTURE,
                coordinate_level: MatchLevel.PREFECTURE,
                matchedCnt: mResult.depth,
                ambiguousCnt: query.ambiguousCnt + (mResult.ambiguous ? 1 : 0),
            }));
        }
        if (!anyHit || anyAmbiguous) {
            results.push(query);
        }
    }

    return results;

}
