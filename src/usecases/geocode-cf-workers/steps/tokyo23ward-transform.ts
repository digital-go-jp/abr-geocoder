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
import {toHiragana, toHiraganaForCharNode} from "@usecases/geocode/services/to-hiragana";
import {kan2num, kan2numForCharNode} from "@usecases/geocode/services/kan2num";
import {jisKanji, jisKanjiForCharNode} from "@usecases/geocode/services/jis-kanji";
import {RegExpEx} from "@domain/services/reg-exp-ex";
import {DASH, DEFAULT_FUZZY_CHAR} from "@config/constant-values";
import {CharNode} from "@usecases/geocode/services/trie/char-node";
import {TrieAddressFinder} from "@usecases/geocode/services/trie/trie-finder";
import {CityMatchingInfo} from "@domain/types/geocode/city-info";
import {ICommonDbGeocode} from "@interface/database/common-db";
import {Query} from "@usecases/geocode/models/query";
import {MatchLevel} from "@domain/types/geocode/match-level";
import {PrefLgCode} from "@domain/types/pref-lg-code";

const needsCopy = new Set([
    '北区',
    '中央区',
    '港区',
    '大田区',
    '板橋区'
]);

const normalizeStr = (address: string): string => {
    // 片仮名を平仮名に変換する
    address = toHiragana(address);

    // 漢数字を半角数字に変換する
    address = kan2num(address);

    // JIS 第2水準 => 第1水準 及び 旧字体 => 新字体
    address = jisKanji(address);

    // 〇〇番地[〇〇番ー〇〇号]、の [〇〇番ー〇〇号] だけを取る
    address = address?.replaceAll(RegExpEx.create(`(\\d+)${DASH}?[番号町地丁目]+の?`, 'g'), `$1${DASH}`);

    return address;
}

const normalizeCharNode = (address: CharNode | undefined): CharNode | undefined => {
    // 〇〇番地[〇〇番ー〇〇号]、の [〇〇番ー〇〇号] だけを取る
    address = address?.replaceAll(RegExpEx.create(`(\\d+)${DASH}?[番号町地丁目]+の?`, 'g'), `$1${DASH}`);

    // 片仮名を平仮名に変換する
    address = toHiraganaForCharNode(address);

    // 漢数字を半角数字に変換する
    address = kan2numForCharNode(address);

    // JIS 第2水準 => 第1水準 及び 旧字体 => 新字体
    address = jisKanjiForCharNode(address);

    return address;
}

export const tokyo23WardTransform = async (commonDbGeocode: ICommonDbGeocode, queries: Query[]): Promise<Query[]> => {
    const tokyo23wards = await commonDbGeocode.getTokyo23Wards();
    const tokyo23WardTrie = new TrieAddressFinder<CityMatchingInfo>();
    for (const ward of tokyo23wards) {
        tokyo23WardTrie.append({
            key: normalizeStr(ward.key),
            value: ward,
        });
    }

    const results: Query[] = [];
    for (const query of queries) {
        // 行政区が判明している場合はスキップ
        if (!query.tempAddress ||
            query.match_level.num >= MatchLevel.CITY.num) {
            results.push(query);
            continue;
        }


        //　東京都〇〇区〇〇パターンを探索する
        const target = normalizeCharNode(query.tempAddress)!;
        const searchResults = tokyo23WardTrie.find({
            target,
            extraChallenges: ['区'],
            partialMatches: true,
            fuzzy: DEFAULT_FUZZY_CHAR,
        });
        if (!searchResults || searchResults.length === 0) {
            results.push(query);
            continue;
        }

        let anyAmbiguous = false;
        let anyHit = false;
        searchResults.forEach(searchResult => {
            if (!searchResult.info) {
                throw new Error('searchResult.info is empty');
            }

            // 同じ区名で他都道府県に存在するので、
            // この時点で東京都と判定できていない場合は、
            // 他都道府県の可能性もあるので、ヒットしない場合もキープしておく
            if (query.lg_code !== PrefLgCode.TOKYO && needsCopy.has(searchResult.info.city)) {
                anyAmbiguous = true;
            }
            anyAmbiguous = anyAmbiguous || searchResult.ambiguous;
            anyHit = true;

            results.push(query.copy({
                pref_key: searchResult.info.pref_key,
                city_key: searchResult.info.city_key,
                tempAddress: searchResult.unmatched,
                match_level: MatchLevel.CITY,
                matchedCnt: query.matchedCnt + searchResult.depth,
                pref: searchResult.info.pref,
                city: searchResult.info.city,
                lg_code: searchResult.info.lg_code,
                rep_lat: searchResult.info.rep_lat,
                rep_lon: searchResult.info.rep_lon,
                coordinate_level: MatchLevel.CITY,
                ambiguousCnt: query.ambiguousCnt + (searchResult.ambiguous ? 1 : 0),
            }));
        });
        if (!anyHit || anyAmbiguous) {
            results.push(query);
        }
    }
    return results
}
