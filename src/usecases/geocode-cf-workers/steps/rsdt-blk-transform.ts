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
import {DASH, DEFAULT_FUZZY_CHAR, SPACE} from "@config/constant-values";
import {RegExpEx} from "@domain/services/reg-exp-ex";
import {GeocodeWorkerD1Controller} from "@interface/database/D1/geocode-worker-d1-controller";
import {SearchTarget} from "@domain/types/search-target";
import {MatchLevel} from "@domain/types/geocode/match-level";

const getBlockNum = (query: Query) => {

    let p: CharNode | undefined = query.tempAddress;
    const buffer: string[] = [];
    // マッチした文字数
    let matchedCnt = 0;

    while (p) {
        if (p.char === DEFAULT_FUZZY_CHAR) {
            // fuzzyの場合、任意の１文字
            // TODO: Databaseごとの処理に対応させる
            buffer.push('_');
            matchedCnt++;
        } else if (/\d/.test(p.char!)) {
            buffer.push(p.char!);
            matchedCnt++;
        } else {
            break;
        }
        p = p.next;
    }

    // レアケースで「渡辺」という番地がある
    if (matchedCnt === 0) {
        p = query.tempAddress;
        while (p) {
            if (p.char === SPACE || p.char === DASH) {
                break;
            }
            matchedCnt++;
            buffer.push(p.char!);
            p = p.next;
        }
    }

    return {
        block_num: buffer.join(''),
        block_id: query.block_id!,
        unmatched: p,
        matchedCnt,
    };
}

const normalizeCharNode = (address: CharNode | undefined): CharNode | undefined => {

    // 先頭にDashがある場合、削除する
    address = address?.replace(RegExpEx.create(`^${DASH}+`), '');

    // [〇〇]番地、[〇〇]番　〇〇丁目[〇〇]ー〇〇　の [〇〇] だけを取る
    const buffer: CharNode[] = [];

    enum Status {
        UNDEFINED,
        BANCHI,
        GOU,
    };

    let status = 0;
    let head: CharNode | undefined = address;
    while (head) {
        if (status === Status.UNDEFINED) {
            for (const word of ['番地割', '地割', '番地', '番']) {
                let extra: CharNode | undefined = head;
                let cnt = 0;
                for (const char of word) {
                    if (extra?.char !== char) {
                        break;
                    }
                    cnt++;
                    extra = extra.next;
                }
                if (cnt === word.length) {
                    status = Status.BANCHI;
                    buffer.push(new CharNode(word, DASH));
                    status = Status.BANCHI;
                    head = extra;
                    break;
                }
            }
        } else if ((status === Status.BANCHI) && (head.char === '号')) {
            buffer.push(new CharNode(head.originalChar, DASH));
            head = head.next;
            continue;
        }
        buffer.push(new CharNode(head?.originalChar, head?.char));
        head = head?.next;
    }

    // 末尾にDashだったら、取る
    if ((buffer.length > 0) && (buffer.at(-1)?.char === DASH)) {
        buffer.pop();
    }

    const result = new CharNode('', '');
    let tail: CharNode | undefined = result;
    buffer.forEach(node => {
        tail!.next = node;
        tail = tail?.next;
    })

    return result.next;
}

export const rsdtBlkTransform = async (dbCtrl: GeocodeWorkerD1Controller, queries: Query[]): Promise<Query[]> => {

    const results: Query[] = [];
    for await (const query of queries) {
        if (query.searchTarget === SearchTarget.PARCEL) {
            // 地番検索が指定されている場合、このステップはスキップする
            results.push(query);
            continue;
        }

        // town_key が必要なので、TOWN_LOCAL未満はスキップ
        // もしくは 既に地番データが判明している場合もスキップ
        if (query.match_level.num < MatchLevel.MACHIAZA.num ||
            query.match_level === MatchLevel.PARCEL) {
            results.push(query);
            continue;
        }
        if (!query.tempAddress) {
            // 探索する文字がなければスキップ
            results.push(query);
            continue;
        }

        // rest_abr_flg = 0のものは地番を検索する
        // if (query.rsdt_addr_flg === 0) {
        //   results.push(query);
        //   continue;
        // }

        if (!query.town_key) {
            results.push(query);
            continue;
        }
        const target = normalizeCharNode(query.tempAddress);
        if (!target || !query.lg_code) {
            results.push(query);
            continue;
        }

        const db = await dbCtrl.openRsdtBlkDb({
            lg_code: query.lg_code,
            createIfNotExists: false,
        });
        if (!db) {
            // DBをオープンできなければスキップ
            results.push(query);
            continue;
        }

        // ------------------------
        // 街区符号で当たるものがあるか
        // ------------------------
        const queryInfo = getBlockNum(query);
        const findResults = await db.getBlockNumRows({
            town_key: query.town_key,
            blk_num: queryInfo.block_num,
        });

        // 番地が見つからなかった
        if (findResults.length === 0) {
            results.push(query);
            continue;
        }

        findResults.forEach(result => {
            results.push(query.copy({
                block: result.blk_num.toString(),
                block_id: result.blk_id,
                rep_lat: result.rep_lat,
                rep_lon: result.rep_lon,
                rsdtblk_key: result.rsdtblk_key,
                tempAddress: queryInfo.unmatched,
                match_level: MatchLevel.RESIDENTIAL_BLOCK,
                coordinate_level: MatchLevel.RESIDENTIAL_BLOCK,
                matchedCnt: query.matchedCnt + queryInfo.matchedCnt,
            }));
        })
    }

    return results;
}
