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
import { DASH, SPACE } from '@config/constant-values';
import { RegExpEx } from '@domain/services/reg-exp-ex';
import { CharNode } from "@usecases/geocode/models/trie/char-node";
import { Transform, TransformCallback } from 'node:stream';
import { QuerySet } from '../models/query-set';
import { isDigit } from '../services/is-number';
import { trimDashAndSpace } from '../services/trim-dash-and-space';

export class NormalizeBanchomeTransform extends Transform {

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
    const results = new QuerySet();
    for (const query of queries.values()) {
      // 残り文字列がない場合はスキップ
      if (query.tempAddress === undefined) {
        results.add(query);
        continue;
      }

      // 空白がある位置より前と後に分ける
      const [before, ...after] = query.tempAddress.split(RegExpEx.create(SPACE, 'g'));
 
      // 正規化する
      const normalized = this.normalize(before);

      // 結合する
      let tempAddress = CharNode.joinWith(new CharNode({
        originalChar: SPACE,
        char: SPACE,
      }), normalized, ...after);

      // 先頭と末尾にDASHかSPACEが付いていたら取る
      tempAddress = trimDashAndSpace(tempAddress);
      
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

    const head: CharNode | undefined = new CharNode({
      char: '',
    });
    let top: CharNode;
    while (stack.length > 0) {
      top = stack.pop()!;
      if (top.ignore || !top.char) {
        top.next = head.next;
        head.next = top;
        continue;
      }

      // (DASH)ガーデンテラスのとき、(DASH)をスペースに置き換える
      // if (stack.at(-1)?.char === DASH && !isDigitForCharNode(top)) {
      //   const removed = stack.pop();
      //   top.next = head.next;
      //   head.next = top;
      //   const space = new CharNode({
      //     char: SPACE,
      //     originalChar: removed && removed.originalChar,
      //   });
      //   space.next = head.next;
      //   head.next = space;
      //   continue;
      // }

      // 「第1地番」「第2地区」のようになっているときは、「第」を取る
      if (stack.at(-2)?.char === '第' && isDigit(top)) {
        let pointer2: CharNode | undefined = head.next?.moveToNext();
        while (pointer2 && isDigit(pointer2)) {
          pointer2 = pointer2.next?.moveToNext();
        }
        if (pointer2?.char === '地' && 
          (pointer2?.next?.moveToNext()?.char === '割' || pointer2?.next?.moveToNext()?.char === '区')) {
          
          // 「第」を無視する
          stack.at(-2)!.ignore = true;
          
          const replaced: string[] = [
            pointer2.originalChar || '',
            pointer2.next.moveToNext()?.originalChar || '',
          ];
          
          const dash = new CharNode({
            char: DASH,
            originalChar: replaced.join(''),
          });
          dash.next = pointer2.next.moveToNext()?.next;
          top.next = dash;
          head.next = top;
          continue;
        }
      }

      // 他の置換により、「1番(DASH)」「2番地(DASH)」「3号(DASH)「4条(DASH)」「5地割(DASH)」「6地区(DASH)」になっているときは、DASHだけにする
      if ((isDigit(stack.at(-2)) && stack.at(-1)?.char === '番' && top.char === '地' && head.next?.moveToNext()?.char === DASH) ||
        (isDigit(stack.at(-1)) && top.char === '番' && head.next?.moveToNext()?.char === DASH) ||
        (isDigit(stack.at(-1)) && top.char === '号' && head.next?.moveToNext()?.char === DASH) ||
        (isDigit(stack.at(-1)) && top.char === '条' && head.next?.moveToNext()?.char === DASH) ||
        (isDigit(stack.at(-1)) && top.char === '丁' && head.next?.moveToNext()?.char === '目') ||
        // (isDigitForCharNode(stack.at(-1)) && top.char === '地' && head.next?.moveToNext()?.char === '割') ||
        // (isDigitForCharNode(stack.at(-1)) && top.char === '地' && head.next?.moveToNext()?.char === '区') ||
        (isDigit(stack.at(-1)) && top.char === '町' && head.next?.moveToNext()?.char === '目')) {

        const replaced: string[] = [];
        while (stack.length > 0 && !isDigit(stack.at(-1))) {
          const removed = stack.pop();
          if (removed && removed.originalChar) {
            replaced.push(removed.originalChar);
          }
        }
        stack.push(new CharNode({
          char: DASH,
          originalChar: replaced.reverse().join(''),
        }));
        head.next = head?.next.next;
        continue;
      }

      // 1番地, 2番街, 3番地, 4番館, 5号棟, 6号室, 7号館, 8号室 など
      if (isDigit(stack.at(-1)) &&
      RegExpEx.create('[番号]').test(top.char || '')) {
        const removed: string[] = [];
        if (head.next?.char === '地') {
          // 「地」を取る
          if (head.next.originalChar) {
            removed.push(head.next.originalChar);
          }
          head.next = head.next.next;
        }
        // 「1番地の3」の可能性もあるので、「の」があれば取る
        if (head.next?.char === 'の' && isDigit(head.next?.next)) {
          if (head.next.originalChar) {
            removed.push(head.next.originalChar);
          }
          head.next = head.next.next;
        }
        // 「1番3号」の場合もあるし、「1番地3号室」の場合もある。
        // 3の後ろに「号」があれば「室,棟,区,館」の場合はDashを入れない
        if (!RegExpEx.create('[室棟区館]').test(head.next?.char || '')) {
          const dash = new CharNode({
            char: DASH,
            originalChar: removed.reverse().join(''),
          });
          dash.next = head.next;
          head.next = dash;
          continue;
        }
        removed.length = 0;

        // 3号「室,棟,区,館」の場合、3の前に DASHがあれば、SPACEにする
        const buffer: CharNode[] = [];
        while (stack.length > 0 && isDigit(stack.at(-1))) {
          buffer.push(stack.pop()!);
        }
        while (RegExpEx.create(`[号番${DASH}]`).test(stack.at(-1)?.char || '')) {
          const tmp = stack.pop();
          if (tmp && tmp.originalChar) {
            removed.push(tmp.originalChar);
          }
        }
        stack.push(new CharNode({
          char: SPACE,
          originalChar: removed.reverse().join(''),
        }));
        stack.push(...buffer);
        top.next = head.next;
        head.next = top;
        continue;
      }
      if (isDigit(stack.at(-1)) && RegExpEx.create('[のノ之]').test(top.char || '') && isDigit(head.next)) {
        top.char = DASH;
        top.originalChar = DASH;
        top.next = head.next;
        head.next = top;
        continue;
      }

      top.next = head.next;
      head.next = top;
    }

    return head.next;
  }
}
