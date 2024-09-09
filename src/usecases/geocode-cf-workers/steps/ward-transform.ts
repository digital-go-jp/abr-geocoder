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
import {toHankakuAlphaNum, toHankakuAlphaNumForCharNode} from "@usecases/geocode/services/to-hankaku-alpha-num";
import {jisKanji, jisKanjiForCharNode} from "@usecases/geocode/services/jis-kanji";
import {toHiragana, toHiraganaForCharNode} from "@usecases/geocode/services/to-hiragana";
import {CharNode} from "@usecases/geocode/services/trie/char-node";
import {ICommonDbGeocode} from "@interface/database/common-db";
import {Query} from "@usecases/geocode/models/query";
import {WardMatchingInfo} from "@domain/types/geocode/ward-info";
import {TrieAddressFinder} from "@usecases/geocode/services/trie/trie-finder";
import {MatchLevel} from "@domain/types/geocode/match-level";
import {AMBIGUOUS_RSDT_ADDR_FLG, DEFAULT_FUZZY_CHAR} from "@config/constant-values";

const normalizeStr = (address: string): string => {

    // 漢数字を半角英数字にする
    address = toHankakuAlphaNum(address);

    // JIS 第2水準 => 第1水準 及び 旧字体 => 新字体
    address = jisKanji(address);

    // カタカナは全てひらがなにする（南アルプス市）
    address = toHiragana(address);

    return address;
}


const normalizeCharNode = (address: CharNode | undefined): CharNode | undefined => {

    // 漢数字を半角英数字にする
    address = toHankakuAlphaNumForCharNode(address);

    // JIS 第2水準 => 第1水準 及び 旧字体 => 新字体
    address = jisKanjiForCharNode(address);

    // カタカナは全てひらがなにする（南アルプス市）
    address = toHiraganaForCharNode(address);

    return address;
}

export const wardTransform = async (commonDbGeocode: ICommonDbGeocode, queries: Query[]): Promise<Query[]> => {
    const wards = await commonDbGeocode.getWards();
    const wardTrie = new TrieAddressFinder<WardMatchingInfo>();
    for (const ward of wards) {
        wardTrie.append({
            key: normalizeStr(ward.key),
            value: ward,
        });
    }

    const results: Query[] = [];
    // ----------------------------------------------
    // 〇〇区から始まるパターンは、
    // 続く大字、町名、小字を調べないと分からないので
    // Databaseから取得して、動的にトライ木を作って探索する
    // ----------------------------------------------
    // 行政区が判明できているQueryと、そうでないQueryに分ける
    let targets: Query[] = [];
    queries.forEach(query => {
        if (query.match_level.num >= MatchLevel.CITY.num) {
            results.push(query);
        } else {
            targets.push(query);
        }
    });

    // 全て行政区が判明できているなら、スキップする
    if (targets.length === 0) {
        return results;
    }


    // 〇〇区を全て探索すると効率が悪いので、
    // 類似度が高い（もしくは一致する）〇〇区を探す
    const possibleWards: WardMatchingInfo[] = [];
    const filteredTargets = targets.filter(query => {
        if (!query.tempAddress) {
            // 探索する文字がなければスキップ
            results.push(query);
            return false;
        }

        // 〇〇市〇〇区　パターンを探す
        const searchResults2 = wardTrie.find({
            target: normalizeCharNode(query.tempAddress)!,
            extraChallenges: ['市', '区'],
            fuzzy: DEFAULT_FUZZY_CHAR,
        });
        let anyHit = false;
        searchResults2?.forEach(result => {
            if (!result.info) {
                return;
            }

            if (query.match_level === MatchLevel.UNKNOWN) {
                anyHit = true;
                possibleWards.push(result.info);
                return;
            }

            if (
                query.match_level === MatchLevel.PREFECTURE &&
                query.pref_key === result.info.pref_key
            ) {
                anyHit = true;
                possibleWards.push(result.info);
            }
        })
        if (!anyHit) {
            results.push(query);
        }
        return anyHit;
    })

    // 可能性がありそうな〇〇区を指定して、トライ木を作成する
    for await (const ward of possibleWards) {

        // 対象がなくなればbreak
        if (targets.length === 0) {
            break;
        }

        const trie = new TrieAddressFinder<WardMatchingInfo>();

        // 〇〇区に所属する市町村を試す
        const townRows = await commonDbGeocode.getWardRows({
            ward: ward.key,
            city_key: ward.city_key,
        });

        townRows.forEach(row => trie.append({
            key: normalizeStr(row.key),
            value: row,
        }));

        for (const query of filteredTargets) {
            if (!query.tempAddress) {
                results.push(query);
                continue;
            }

            if (query.match_level.num > MatchLevel.PREFECTURE.num) {
                results.push(query);
                continue;
            }

            let matched = trie.find({
                target: normalizeCharNode(query.tempAddress)!,
                extraChallenges: ['市', '町', '村'],
                partialMatches: true,
                fuzzy: DEFAULT_FUZZY_CHAR,
            });

            if (!matched) {
                results.push(query);
                continue;
            }
            let anyAmbiguous = false;
            let anyHit = false;
            for (const mResult of matched) {
                if (query.pref_key !== mResult.info?.pref_key) {
                    continue;
                }
                anyAmbiguous = anyAmbiguous || mResult.ambiguous;
                anyHit = true;

                // ここで大字を確定させると、rsdt_blk に入らなくなってしまうので、
                // あくまでも 〇〇区までに留める
                const oazaTmpAddress = (() => {
                    if (!mResult.info!.oaza_cho) {
                        return;
                    }
                    if (mResult.unmatched) {
                        return mResult.unmatched.splice(0, 0, mResult.info!.oaza_cho);
                    } else {
                        return new CharNode(mResult.info!.oaza_cho);
                    }
                })();
                results.push(query.copy({
                    pref_key: mResult.info!.pref_key,
                    city_key: mResult.info!.city_key,
                    pref: mResult.info!.pref,
                    city: mResult.info!.city,
                    lg_code: mResult.info!.lg_code,
                    county: mResult.info!.county,
                    ward: mResult.info!.ward,
                    tempAddress: oazaTmpAddress,
                    match_level: MatchLevel.MACHIAZA,
                    rsdt_addr_flg: AMBIGUOUS_RSDT_ADDR_FLG,
                    matchedCnt: query.matchedCnt + mResult.depth - mResult.info!.oaza_cho.length,
                    rep_lat: mResult.info?.rep_lat,
                    rep_lon: mResult.info?.rep_lon,
                    coordinate_level: MatchLevel.CITY,
                    ambiguousCnt: query.ambiguousCnt + (mResult.ambiguous ? 1 : 0),
                }));
            }

            // 〇〇区で始まるパターンの場合、誤マッチングの可能性があるので
            // マッチしなかった可能性もキープしておく
            if (!anyHit || anyAmbiguous || query.match_level === MatchLevel.UNKNOWN) {
                results.push(query);
            }
        }
    }

    return results;
}
