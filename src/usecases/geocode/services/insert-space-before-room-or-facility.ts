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
import { SPACE, KANJI_NUMS, DASH } from "@config/constant-values";
import { RegExpEx } from "@domain/services/reg-exp-ex";
import { isDigitForCharNode } from "./is-number";
import { CharNode } from "./trie/char-node";

export const insertSpaceBeforeRoomOrFacility = (address: CharNode | undefined): CharNode | undefined => {
  if (!address) {
    return;
  }

  // 最初に空白がある位置より前と後に分ける
  const [before, ...after] = address.split(RegExpEx.create(SPACE, 'g'));

  const kanjiNums = RegExpEx.create(`[${KANJI_NUMS}]`);

  const stack: CharNode[] = before.split('');
  const head: CharNode = new CharNode({
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

    // DASH + (数字) + (数字以外)の場合、(数字)+(数字以外)の間にスペースを入れる
    if (
      isDigitForCharNode(stack.at(-1)) &&
      !isDigitForCharNode(top) &&
      !RegExpEx.create(`[号番通条棟階${DASH}${SPACE}a-z]`, 'i').test(top.char)
    ) {
      let foundDash = false;
      for (let i = -2; i >= -stack.length + 1; i--) {
        const node = stack.at(i);
        if (isDigitForCharNode(node)) {
          continue;
        }
        foundDash = node?.char === DASH;
        break;
      }
      if (foundDash) {
        // SPACEを入れる
        const space = new CharNode({
          char: SPACE,
        });
        top.next = head.next;
        space.next = top;
        head.next = space;
        continue;
      }
    }
    
    // (数字) + 「の」+ (数字」)の場合、「の」をDASHにする
    if (
      (
        kanjiNums.test(stack.at(-2)?.originalChar || '') ||
        isDigitForCharNode(stack.at(-2))
      ) &&
      RegExpEx.create('[のノ丿之]').test(stack.at(-1)?.char || '') &&
      (
        kanjiNums.test(top?.originalChar || '') ||
        isDigitForCharNode(top)
      )
    ) {
      // 「の」を取る
      const removed = stack.pop();
      // DASHにする
      const dash = new CharNode({
        char: DASH,
        originalChar: removed?.originalChar,
      });
      top.next = head.next;
      dash.next = top;
      head.next = dash;
      continue;
    }

    // 算用数字と漢数字の間にスペースを入れる
    if (isDigitForCharNode(top) && !kanjiNums.test(top.originalChar!) &&
      head.next?.moveToNext()?.char !== DASH &&  // (数字)+(漢数字の「一」)+(数字)の場合、「一」をDashに置き換えるため
      kanjiNums.test(head.next?.moveToNext()?.originalChar || '')) {
      const space = new CharNode({
        char: SPACE,
      });
      space.next = head.next?.moveToNext();
      top.next = space;
      head.next = top;
      continue;
    }

    // 12-34-56号室のとき、4-5の間のDashをスペースに置き換える
    // https://github.com/digital-go-jp/abr-geocoder/issues/157
    if (isDigitForCharNode(stack.at(-1)) && 
      ((top.char === '号' && head.next?.char === '室') || 
      RegExpEx.create('[a-z]', 'i').test(top.char))
    ) {
      // 号を headにつなげる
      top.next = head.next;
      head.next = top;
      // 数字を headにつなげる
      while (isDigitForCharNode(stack.at(-1))) {
        const num = stack.pop()!;
        num.next = head.next;
        head.next = num;
      }
      const buffer: string[] = [];
      while (RegExpEx.create(`[号番通条${DASH}${SPACE}]`).test(stack.at(-1)?.char || '')) {
        const removed = stack.pop();
        if (removed && removed.originalChar) {
          buffer.push(removed.originalChar);
        }
      }
      // if (stack.at(-1)?.char === DASH) {
      const space = new CharNode({
        char: SPACE,
        originalChar: buffer.reverse().join(''),
      });
      space.next = head.next;
      head.next = space;
      // }
      continue;
    }

    top.next = head.next;
    head.next = top;
  }

  // 結合する
  const separator = new CharNode({
    char: SPACE,
  });
  const result = CharNode.joinWith(separator, head.next, ...after);
  return result;
};
