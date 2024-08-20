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

import { DASH, SPACE } from "@config/constant-values";
import { CharNode } from "./trie/char-node";


const kanjiNum = new Map<string, number>([
  ['壱', 1],
  ['一', 1],
  ['１', 1],
  ['1', 1],

  ['二', 2],  // 漢数字の２
  ['ニ', 2],  // 漢数字の２
  ['ニ', 2],  // カタカナの２
  ['弐', 2],
  ['２', 2],
  ['2', 2],

  ['参', 3],
  ['3', 3],
  ['三', 3],
  ['３', 3],

  ['４', 4],
  ['4', 4],
  ['四', 4],

  ['５', 5],
  ['5', 5],
  ['五', 5],

  ['６', 6],
  ['6', 6],
  ['六', 6],

  ['７', 7],
  ['7', 7],
  ['七', 7],

  ['８', 8],
  ['8', 8],
  ['八', 8],

  ['９', 9],
  ['9', 9],
  ['九', 9],

  ['〇', 0],
  ['0', 0],
  ['０', 0],
  ['零', 0],

  ['十', 10],
]);

const SENTINEL = '&';
const targetPatterns = new Set<string>([
  '通',
  '丁', // 東十二丁目 -> 東12丁目
  '町',
  '字', 
  '通',
  '番',
  '番',
  '部', // 壱壱壱部25 -> 111部25
  '所', // 十二所 -> 12所
  '社', // 三十八社町 -> 38社町
  '線', // 西六線北二十六号 -> 西6線北26号
  '号', // 西六線北二十六号 -> 西6線北26号
  '条', // 東十五条南 -> 東15条南
  '里', // 九十九里町 -> 99里町
  SENTINEL,
  DASH,
  SPACE,
  'の',
  '之',
  'ノ',
  '丿',
]);

export const kan2num = (target: string) => {
  const result: string[] = [];
  const stack: string[] = [];

  target = target + SENTINEL;
  
  // Monotonic stackを使って解く
  const N = target.length;
  for (let i = 0; i < N; i++) {
    const char = target[i];

    // 漢数字なら、stackに溜め込む
    if (kanjiNum.has(char)) {
      stack.push(char);
      continue;
    }

    if (!targetPatterns.has(char)) {
      // ターゲットパターンではないので、漢数字を復元する
      result.push(...stack);
      result.push(char);
      stack.length = 0;
      continue;
    }


    // 漢数字が現れてきて、別の文字が現れたので、連続した漢数字が終了したことを意味する。
    // なので、stack に溜まっている漢数字を算用数字に変換する
    let current = 0;
    const tempResult = [];
    while (stack.length > 0) {
      let val = kanjiNum.get(stack.pop()!)!;

      if (val === 0) {
        tempResult.push(current.toString());
        tempResult.push('0');
        current = 0;
        continue;

      } else if (val === 10) {
        val = 10;
        // 十が初めて出現する場合、current = 0 なので、
        // current = 0 + 10 = 10 となる。
        //
        // または「"十六"」のように漢数字だけで、最後が「十」でない場合、
        // current = 6 となっているので
        // current = 6 + 10 = 16 となる。 
        if (!stack.length) {
          current += val;
          continue;
        }
        // 二十一のように、「一」の後に「十」が出てきた場合
        // 続く「二」を取って「20」を作成した後に「1」を足す
        const bias10 = kanjiNum.get(stack.pop()!)!;
        current = bias10 * val + current;
        tempResult.push(current.toString());
        current = 0;
        continue;
      } else {
        // 五四三 のように １桁の数字が続く場合、一度リセットする
        if (current > 0) {
          tempResult.push(current.toString());
        }
        current = 0;
      }
      // 「十三」の場合、「三」が先に出現するので、currentにキープ。
      current += val;
    }
    if (current > 0) {
      tempResult.push(current.toString());
    }
    result.push(...tempResult.reverse());

    // iが最後ではない or 最後の文字が漢数字ではない場合、resultに追加
    if (!kanjiNum.has(char)) {
      result.push(char);
    }
  }
  result.pop();
  return result.join('');
};

export const kan2numForCharNode = (target: CharNode | undefined) : CharNode | undefined => {
  const result: CharNode[] = [];
  const buffer: CharNode[] = [];
  
  let currentNumber = 0;
  let lastWasTen = false; // 直前の文字が「十」かどうか

  let head = target;
  let headNext: CharNode | undefined;

  while (head && (head.ignore || head.char)) {
    if (head.ignore || !head.char) {
      if (buffer.length > 0) {
        // 1文字ずつに変換する
        const tmp = currentNumber.toString().split('');
        for (const node of buffer) {
          if (tmp.length === 0) {
            break;
          }
          node.char = tmp.shift();
          result.push(node); 
        }
        while (tmp.length > 0) {
          result.push(new CharNode({
            originalChar: '',
            char: tmp.shift()!,
          }));
        }
        buffer.length = 0;
        currentNumber = 0;
        lastWasTen = false;
      }
      headNext = head.next;
      head.next = undefined;
      result.push(head);
      head = headNext;
      continue;
    }

    const char = head.char;
    const num = kanjiNum.get(char);

    // 漢数字以外の場合
    if (num === undefined) {
      if (!targetPatterns.has(char)) {
        // ターゲットパターンではないときは、復元する
        result.push(...buffer);
      } else if (currentNumber > 0) {
        // 現在の数値が 0 より大きい場合のみ追加

        // 1文字ずつに変換する
        const tmp = currentNumber.toString().split('');
        for (const node of buffer) {
          if (tmp.length === 0) {
            break;
          }
          node.char = tmp.shift();
          result.push(node); 
        }
        while (tmp.length > 0) {
          result.push(new CharNode({
            originalChar: '',
            char: tmp.shift()!,
          }));
        }
      }
      buffer.length = 0;
      currentNumber = 0;
      lastWasTen = false;
      headNext = head.next;
      head.next = undefined; 
      result.push(head);
      head = headNext;
      continue;
    }
    
    // 漢数字の場合
    if (num >= 10) {
      if (currentNumber === 0) {
        currentNumber = num;
      } else {
        currentNumber *= num;
      }
      lastWasTen = (num === 10); // 「十」だった場合はフラグを立てる
    } else {
      if (lastWasTen) {
        // 直前の文字が「十」だった場合
        currentNumber += num; // 単純に加算
        lastWasTen = false; // フラグをリセット
      } else {
        currentNumber = currentNumber * 10 + num;
      }
    }
    headNext = head.next;
    head.next = undefined;
    buffer.push(head);

    head = headNext;
  }

  // 最後の数値を追加（末尾が「十」の場合の処理を修正）
  if (currentNumber > 0) {
    // 1文字ずつに変換する
    const tmp = currentNumber.toString().split('');
    if (tmp.length > buffer.length) {
      for (const node of buffer) {
        node.char = tmp.shift();
        result.push(node); 
      }
      while (tmp.length > 0) {
        result.push(new CharNode({
          originalChar: '',
          char: tmp.shift()!,
        }));
      }
    } else {
      while (buffer.length > 0) {
        const node = buffer.shift()!;
        if (tmp.length > 0) {
          node.char = tmp.shift()!;
        } else {
          node.char = '';
        }
        result.push(node);
      }
    }
    // for (const node of buffer) {
    //   result.push(node); // 現在の数値が 0 より大きい場合のみ追加
    //   node.char = '';
    // }
    // buffer[0].char = currentNumber.toString();
    // buffer.length = 0;
  }

  const resultNode = new CharNode({
    char: '',
  });
  let tail = resultNode;
  for (const node of result) {
    tail.next = node;
    tail = tail.next;
    node.next = undefined;
  }

  return resultNode.next;
};
// const result = kan2numForCharNode(CharNode.create(`１８${DASH}３０４号`));
// console.log(`original`, result?.toOriginalString());
// console.log(`processed`, result?.toProcessedString());

// console.log(kan2num(`東京都港区三田二丁目２番１８${DASH}３０４号`))
