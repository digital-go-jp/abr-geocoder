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
import {CharNode} from "@usecases/geocode/services/trie/char-node";
import {DASH, DEFAULT_FUZZY_CHAR} from "@config/constant-values";
import {GeocodeWorkerD1Controller} from "@interface/database/D1/geocode-worker-d1-controller";
import {SearchTarget} from "@domain/types/search-target";
import {MatchLevel} from "@domain/types/geocode/match-level";
import {IParcelDbGeocode} from "@interface/database/common-db";
import {TableKeyProvider} from "@domain/services/table-key-provider";


// トライ木の作成に時間がかかるので、SQLの LIKE 演算子を使って
// DB内を直接検索するための　prc_id を作成する
// fuzzyが含まれる可能性があるので、'_' に置換する
// ('_'は、SQLiteにおいて、任意の一文字を示す)
const getPrcId = (query: Query) => {

    const PARCEL_LENGTH = 5;
    const ZERO_FILL = ''.padStart(PARCEL_LENGTH, '0');

    let p: CharNode | undefined = query.tempAddress;
    const buffer: string[] = [];
    const current: string[] = [];

    // マッチした文字数
    let matchedCnt = 0;

    while (p) {
        matchedCnt++;
        if (p.char === DEFAULT_FUZZY_CHAR) {
            // fuzzyの場合、任意の１文字
            // TODO: Databaseごとの処理
            current.push('_');
        } else if (/\d/.test(p.char!)) {
            current.push(p.char!);
        } else if (p.char === DASH) {
            buffer.push(current.join('').padStart(PARCEL_LENGTH, '0'));
            current.length = 0;
        } else {
            break;
        }
        p = p.next;
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
    return {
        parcel_key: parcelKey,
        unmatched: p,
        matchedCnt
    };
}

export const parcelTransform = async (dbCtrl: GeocodeWorkerD1Controller, queries: Query[]): Promise<Query[]> => {

    // ------------------------
    // 地番で当たるものがあるか
    //
    // 地域によっては、town.rsdt_addr_flg = 1 でも
    // parcelテーブルにデータが含まれている場合もある。
    // なので、parcelテーブルを探して、完全一致しない場合は、rsdt_blk,rsdtdsp_rsdtテーブルを探す
    // ------------------------


    const results: Query[] = [];
    for await (const query of queries) {
        if (query.searchTarget === SearchTarget.RESIDENTIAL) {
            // 住居表示検索が指定されている場合、このステップはスキップする
            results.push(query);
            continue;
        }

        // lg_code が必要なので、CITY未満はスキップする
        if (query.match_level.num < MatchLevel.CITY.num) {
            results.push(query);
            continue;
        }

        // 既に住居表示で見つかっている場合もスキップ
        if (query.match_level.num === MatchLevel.RESIDENTIAL_BLOCK.num ||
            query.match_level.num === MatchLevel.RESIDENTIAL_DETAIL.num) {
            results.push(query);
            continue;
        }

        if (!query.lg_code) {
            results.push(query);
            continue;
        }
        if (!query.tempAddress) {
            // 探索する文字がなければスキップ
            results.push(query);
            continue;
        }
        const db: IParcelDbGeocode | null = await dbCtrl.openParcelDb({
            lg_code: query.lg_code,
            createIfNotExists: false,
        });
        if (!db) {
            // DBをオープンできなければスキップ
            results.push(query);
            continue;
        }

        const searchInfo = getPrcId(query);
        if (!query.lg_code) {
            // もし lgCode がなければスキップする
            continue;
        }

        // city_key, town_key で指定した地番情報を取得
        const findResults = await db.getParcelRows({
            prc_id: searchInfo.parcel_key,
            city_key: TableKeyProvider.getCityKey({
                lg_code: query.lg_code,
            }),
            town_key: TableKeyProvider.getTownKey({
                machiaza_id: query.machiaza_id,
                lg_code: query.lg_code,
            })
        });

        // 見つからなかった
        if (findResults.length === 0) {
            results.push(query);
            continue;
        }

        findResults.forEach(row => {
            results.push(query.copy({
                parcel_key: row.parcel_key,
                prc_id: row.prc_id,
                prc_num1: row.prc_num1,
                prc_num2: row.prc_num2,
                prc_num3: row.prc_num3,
                rep_lat: row.rep_lat,
                rep_lon: row.rep_lon,
                tempAddress: searchInfo.unmatched,
                match_level: MatchLevel.PARCEL,
                coordinate_level: MatchLevel.PARCEL,
                matchedCnt: query.matchedCnt + searchInfo.matchedCnt,
            }));
        });
    }
    return results
}
