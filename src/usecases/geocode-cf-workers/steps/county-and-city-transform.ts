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
import {ICommonDbGeocode} from "@interface/database/common-db";
import {Query} from "@usecases/geocode/models/query";
import {TrieAddressFinder} from "@usecases/geocode/services/trie/trie-finder";
import {CityMatchingInfo} from "@domain/types/geocode/city-info";
import {toHiragana} from "@usecases/geocode/services/to-hiragana";
import {jisKanji} from "@usecases/geocode/services/jis-kanji";
import {kan2num} from "@usecases/geocode/services/kan2num";
import {MatchLevel} from "@domain/types/geocode/match-level";
import {DEFAULT_FUZZY_CHAR} from "@config/constant-values";


const normalizeStr = (value: string): string => {
    // 半角カナ・全角カナ => 平仮名
    value = toHiragana(value);

    // JIS 第2水準 => 第1水準 及び 旧字体 => 新字体
    value = jisKanji(value);

    // 漢数字 => 算用数字
    value = kan2num(value);

    return value;
}

export const countyAndCityTransform = async (commonDbGeocode: ICommonDbGeocode, queries: Query[]): Promise<Query[]> => {
    const countyAndCityList = await commonDbGeocode.getCountyAndCityList();
    const countyAndCityTrie = new TrieAddressFinder<CityMatchingInfo>();
    for (const city of countyAndCityList) {
        countyAndCityTrie.append({
            key: normalizeStr(city.key),
            value: city,
        });
    }


    const results: Query[] = [];
    for (const query of queries) {
        // 既に判明している場合はスキップ
        if (query.match_level.num >= MatchLevel.CITY.num) {
            results.push(query);
            continue;
        }
        if (!query.tempAddress) {
            results.push(query);
            continue;
        }

        // -------------------------
        // 〇〇郡〇〇市町村を探索する
        // -------------------------
        const matched = countyAndCityTrie.find({
            target: query.tempAddress,
            extraChallenges: ['郡', '市', '町', '村'],
            partialMatches: true,
            fuzzy: DEFAULT_FUZZY_CHAR,
        });
        if (!matched || matched.length === 0) {
            results.push(query);
            continue;
        }

        let anyHit = false;
        let anyAmbiguous = false;
        for (const mResult of matched) {
            // 都道府県が判別していない、または判別できでいて、
            // result.pref_key が同一でない結果はスキップする
            // (伊達市のように同じ市町村名でも異なる都道府県の場合がある)
            if (query.match_level.num === MatchLevel.PREFECTURE.num &&
                query.pref_key !== mResult.info?.pref_key) {
                continue;
            }
            anyAmbiguous = anyAmbiguous || mResult.ambiguous;

            results.push(query.copy({
                pref: query.pref || mResult.info!.pref,
                pref_key: query.pref_key || mResult.info!.pref_key,
                city_key: mResult.info!.city_key,
                tempAddress: mResult.unmatched,
                city: mResult.info!.city,
                county: mResult.info!.county,
                ward: mResult.info!.ward,
                rep_lat: mResult.info!.rep_lat,
                rep_lon: mResult.info!.rep_lon,
                lg_code: mResult.info!.lg_code,
                match_level: MatchLevel.CITY,
                coordinate_level: MatchLevel.CITY,
                matchedCnt: query.matchedCnt + mResult.depth,
                ambiguousCnt: query.ambiguousCnt + (mResult.ambiguous ? 1 : 0),
            }));
        }
        if (!anyHit || anyAmbiguous) {
            results.push(query);
        }
    }

    const seen = new Set<string | undefined>();
    const filteredResults = results.filter(x => {
        const tempAddress = x.tempAddress?.toString();
        if (seen.has(tempAddress)) {
            return false;
        }
        seen.add(tempAddress);
        return true;
    });

    return filteredResults

}
