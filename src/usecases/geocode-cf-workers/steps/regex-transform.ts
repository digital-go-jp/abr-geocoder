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
import {CharNode} from "@usecases/geocode/services/trie/char-node";
import {RegExpEx} from "@domain/services/reg-exp-ex";
import {DASH, DASH_SYMBOLS, SPACE, VIRTUAL_SPACE} from "@config/constant-values";
import {Query} from "@usecases/geocode/models/query";
import {MatchLevel} from "@domain/types/geocode/match-level";

const concatCharNode = (p1: CharNode | undefined, p2: CharNode | undefined): CharNode | undefined => {
    if (p1 === undefined || p2 === undefined) {
        return p1 || p2;
    }
    const head = p1;
    while (p1.next) {
        p1 = p1.next;
    }
    p1.next = p2;
    return head;
}

const normalizeCharNode = (p: CharNode | undefined): CharNode | undefined => {
    // p のオリジナルの文字列で「〇〇丁目〇〇番地〇〇号」「〇〇丁目〇〇番地」と残っている部分を
    // 「〇〇丁目〇〇-〇〇」「〇〇丁目〇〇」にする　
    const original = p?.toOriginalString();
    if (original === undefined) {
        return p;
    }

    let tmp = original;
    tmp = tmp.replace(RegExpEx.create(`([0-9]+(?:丁目?))([0-9]+)(?:番地?の?)([0-9]+)号?`), `$1${DASH}]2${DASH}$3`);
    tmp = tmp.replace(RegExpEx.create(`([0-9]+)(?:番地?の?)([0-9]+)(?:号)?`), `$1${DASH}$2`);
    tmp = tmp.replace(RegExpEx.create(`(?:[${DASH_SYMBOLS}${DASH}]|番地?)([0-9]+)号`), `${DASH}$1`);
    tmp = tmp.replace(RegExpEx.create(`([0-9]+)(?:番地?|号)$`), `$1`);
    tmp = tmp.replace(RegExpEx.create(`(?:番地?|号)([0-9]+)$`), `${DASH}$1`);
    tmp = tmp.replace(RegExpEx.create(`(?:番地?)([0-9]+)[${DASH_SYMBOLS}${DASH}]([0-9]+)$`), `${DASH}$1${DASH}$2`);
    tmp = tmp.replace(RegExpEx.create(`(?:番地?)([0-9]+)[${DASH_SYMBOLS}${DASH}]([0-9]+)号$`), `${DASH}$1${DASH}$2`);
    tmp = tmp.replace(RegExpEx.create(`(?:番地?)([0-9]+)[${DASH_SYMBOLS}${DASH}]([0-9]+)号室$`), `${DASH}$1${DASH}$2号室`);
    tmp = tmp.replace(RegExpEx.create(`[${DASH_SYMBOLS}${DASH}]+`), DASH);

    p = CharNode.create(tmp);

    const buffer: CharNode[] = [];
    while (p) {
        while (p && p.ignore) {
            p = p.next;
        }
        if (p === undefined) {
            break;
        }

        if (RegExpEx.create('[0-9]').test(p.char!) || p.char === DASH) {
            buffer.push(CharNode.create(p.char!)!);
            p = p.next;
            continue;
        }
        buffer.push(p);
        p = p.next;
    }

    let result: CharNode | undefined = undefined;
    while (buffer.length > 0) {
        const node = buffer.pop()!;
        node.next = result;
        result = node;
    }
    return result;
}

const splitAtFirstSpace = (p: CharNode | undefined): (CharNode | undefined)[] => {
    const before = new CharNode('');
    let tail: CharNode = before;

    while (p && p.char !== VIRTUAL_SPACE && p.char !== SPACE) {
        tail.next = p;
        tail = tail.next;
        p = p.next;
    }
    tail.next = undefined;
    return [before.next, p];
}

export const regexTransform = async (queries: Query[]): Promise<Query[]> => {

    // ----------------------------------------------
    // rsdt_dsp_flg = 1 の場合、住居表記なので
    // 基本的に「〇〇丁目〇〇番〇〇号」となる
    //
    // rsdt_dsp_flg = 0 の場合、地番表記なので
    // 基本的に「〇〇番地〇〇」となる
    //
    // 正規表現で正規化することを試みる
    // ----------------------------------------------
    const results = queries.map(query => {
        // 残り文字列がない場合
        // RESIDENTIAL, PARCEL の場合はスキップ
        if (
            query.tempAddress === undefined ||
            query.match_level.num === MatchLevel.RESIDENTIAL_DETAIL.num ||
            query.match_level.num === MatchLevel.PARCEL.num
        ) {
            return query;
        }

        // 空白がある位置より前と後に分ける
        const [before, after] = splitAtFirstSpace(query.tempAddress.clone());

        // 正規化する
        const normalized = normalizeCharNode(before);

        // 結合する
        const tempAddress = concatCharNode(normalized, after);

        return query.copy({
            tempAddress,
        })
    });
    return results;
}
