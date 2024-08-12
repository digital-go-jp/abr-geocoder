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
import { Transform, TransformCallback } from 'node:stream';
import { BEGIN_SPECIAL, DASH, DASH_SYMBOLS, END_SPECIAL, SPACE, VIRTUAL_SPACE } from '@config/constant-values';
import { RegExpEx } from '@domain/services/reg-exp-ex';
import { MatchLevel } from '@domain/types/geocode/match-level';
import { Query } from '../models/query';
import { CharNode } from '../services/trie/char-node';
import { DebugLogger } from '@domain/services/logger/debug-logger';
import { QuerySet } from '../models/query-set';
import { isDigitForCharNode } from '../services/is-number';

export class RegExTransform extends Transform {

  constructor(private params: {
    logger: DebugLogger | undefined;
  }) {
    super({
      objectMode: true,
    });
  }

  async _transform(
    queries: QuerySet,
    _: BufferEncoding,
    callback: TransformCallback
  ) {
    // ----------------------------------------------
    // rsdt_dsp_flg = 1 の場合、住居表記なので
    // 基本的に「〇〇丁目〇〇番〇〇号」となる
    //
    // rsdt_dsp_flg = 0 の場合、地番表記なので
    // 基本的に「〇〇番地〇〇」となる
    //
    // 正規表現で正規化することを試みる
    // ----------------------------------------------
    const results = new QuerySet();
    for (const query of queries.values()) {
      // 残り文字列がない場合はスキップ
      if (query.tempAddress === undefined) {
        results.add(query);
        continue;
      }

      // 空白がある位置より前と後に分ける
      const [before, after] = query.tempAddress.split(RegExpEx.create(`[${VIRTUAL_SPACE}${SPACE}]`, 'g'), 2);
 
      // 正規化する
      const normalized = this.normalize(before);

      // 結合する
      const tempAddress = normalized?.concat(new CharNode(SPACE, SPACE), after);
      
      results.add(query.copy({
        tempAddress,
      }));
    }

    // this.params.logger?.info(`regexp : ${((Date.now() - queries[0].startTime) / 1000).toFixed(2)} s`);
    callback(null, results);
  }

  private normalize(p: CharNode | undefined): CharNode | undefined {
    // p のオリジナルの文字列で「〇〇丁目〇〇番地〇〇号」「〇〇丁目〇〇番地」と残っている部分を
    // 「〇〇丁目〇〇-〇〇」「〇〇丁目〇〇」にする　
    if (!p) {
      return;
    }

    const stack: CharNode[] = p.split('');

    const head: CharNode | undefined = new CharNode('');
    let top: CharNode;
    while (stack.length > 0) {
      top = stack.pop()!;
      if (top.ignore || !top.char) {
        top.next = head.next;
        head.next = top;
        continue;
      }

      // (DASH)ガーデンテラスのとき、(DASH)をスペースに置き換える
      if (stack.at(-1)?.char === DASH && !isDigitForCharNode(top)) {
        stack.pop();
        const space = new CharNode(SPACE);
        space.next = head.next;
        top.next = space;
        head.next = top;
        continue;
      }
      // 1番地, 2番地の場合
      if (isDigitForCharNode(stack.at(-1)) && top.char === '番' && head.next?.char === '地') {
        // 「地」を取る
        head.next = head.next.next;
        // 「1番地の3」の可能性もあるので、「の」があれば取る
        if (head.next?.char === 'の' && isDigitForCharNode(head.next?.next)) {
          head.next = head.next.next;
        }
        // 「1番3号」の場合もあるし、「1番地3号室」の場合もある。
        // 3の後ろに「号」があれば「室,棟,区,館」の場合はDashを入れない
        if (head.next?.char === '号' && !RegExpEx.create('[室棟区館]').test(head.next?.next?.char || '')) {
          const dash = new CharNode(DASH);
          dash.next = head.next;
          head.next = dash;
        }
        top.next = head.next;
        head.next = top;
        continue;
      }

      // 「1番3号」の場合もあるし、「1番地3号室」の場合もある。
      // 3の後ろに「号」があれば「室,棟,区,館」の場合はDashを入れない
      if (isDigitForCharNode(stack.at(-1)) && top.char === '号') {
        if (!RegExpEx.create('[室棟区館]').test(head.next?.char || '')) {
          const space = new CharNode(SPACE);
          space.next = head.next;
          head.next = space;
        }
        top.next = head.next;
        head.next = top;
        continue;
      }

      // 234ガーデンテラスのとき、「4」と「ガ」の間にスペースを入れる
      if (isDigitForCharNode(stack.at(-1)) && !RegExpEx.create(`[0-9${DASH}条通]`).test(top.char)) {
        const space = new CharNode(SPACE);
        space.next = head.next;
        head.next = space;
        top.next = head.next;
        head.next = top;
        continue;
      }

      top.next = head.next;
      head.next = top;
    }
    // while (p) {
    //   // 最初の文字が DASHの場合
    //   if (p.char === DASH) {
    //     const tmp = p.next?.moveToNext();
    //     if (!tmp) {
    //       break;
    //     }
    //     if (!RegExpEx.create('[1-9]').test(tmp.char || '')) {
    //       // (DASH)ガーデンテラスのとき、(DASH)をスペースに置き換える
    //       tmp.char = SPACE;
    //       tmp.originalChar = SPACE;
    //     } else {
    //       // -234ガーデンテラスのとき、「4」と「ガ」の間にスペースを入れる

    //       let slow: CharNode | undefined = p;
    //       let fast: CharNode | undefined = slow.next;
    //       while (slow && fast) {
    //         slow = slow.moveToNext();
    //         if (slow?.char === BEGIN_SPECIAL) {
    //           slow = slow?.next?.moveToNext(END_SPECIAL);
    //         }
    //         fast = slow?.next?.moveToNext();
    //         if (fast?.char === BEGIN_SPECIAL) {
    //           fast = fast?.next?.moveToNext(END_SPECIAL);
    //         }

    //         if (!slow || !fast) {
    //           break;
    //         }
    //         if (slow.char === DASH && RegExpEx.create('[1-9]').test(fast.char!)) {
    //           // 数字の終わりを見つける
    //           slow = fast;
    //           fast = fast.next;
    //           while (fast && (fast.ignore || RegExpEx.create('[0-9]').test(fast.char!))) {
    //             slow = fast;
    //             fast = fast.next;
    //           }
    //           if (fast?.char !== DASH && fast?.char !== undefined) {
    //             slow.next = new CharNode(SPACE, SPACE);
    //             slow.next.next = fast;
    //           }
    //           break;
    //         }
    //       }
    //     }
    //   }
    //   p = p?.next?.moveToNext();
    // }

    // const original = head.toOriginalString();
    // let tmp = original.trim();
    // tmp = tmp.replace(RegExpEx.create(`([0-9]+(?:丁目?))([0-9]+)(?:番地?の?)([0-9]+)(?:号(?![室棟区館階])?)`), `$1${DASH}$2${DASH}$3`);
    // tmp = tmp.replace(RegExpEx.create(`([0-9]+)(?:番地?の?)([0-9]+)(?:号(?![室棟区館階])?)?`), `$1${DASH}$2`);
    // tmp = tmp.replace(RegExpEx.create(`(?:[${DASH_SYMBOLS}${DASH}]|番地?)([0-9]+)(?:号(?![室棟区館階])?)`), `$1`);
    // tmp = tmp.replace(RegExpEx.create(`([0-9]+)(?:番地?|号(?![室棟区館階]))`), `$1`);
    // tmp = tmp.replace(RegExpEx.create(`[${DASH_SYMBOLS}${DASH}]([0-9]+)`), `${DASH}$1`);
    // tmp = tmp.replace(RegExpEx.create(`(?:番地?|号)([0-9]+)`), `${DASH}$1`);
    // tmp = tmp.replace(RegExpEx.create(`(?:番地?)([0-9]+)[${DASH_SYMBOLS}${DASH}]([0-9]+)`), `${DASH}$1${DASH}$2`);
    // tmp = tmp.replace(RegExpEx.create(`(?:番地?)([0-9]+)[${DASH_SYMBOLS}${DASH}]([0-9]+)(?:号(?![室棟区館階])?)`), `${DASH}$1${DASH}$2`);
    // tmp = tmp.replace(RegExpEx.create('^番地'), '');
    // tmp = tmp.replace(RegExpEx.create(`${DASH}+`), DASH);
    // console.error(tmp);

    return head.next;
  }
}
