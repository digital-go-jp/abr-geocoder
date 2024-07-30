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

import { CharNode } from "./trie/char-node";

const kanjiNum = new Map<string, string>([
  ['ｶﾞ', 'ガ'],
  ['ｷﾞ', 'ギ'],
  ['ｸﾞ', 'グ'],
  ['ｹﾞ', 'ゲ'],
  ['ｺﾞ', 'ゴ'],
  ['ｻﾞ', 'ザ'],
  ['ｼﾞ', 'ジ'],
  ['ｽﾞ', 'ズ'],
  ['ｾﾞ', 'ゼ'],
  ['ｿﾞ', 'ゾ'],
  ['ﾀﾞ', 'ダ'],
  ['ﾁﾞ', 'ヂ'],
  ['ﾂﾞ', 'ヅ'],
  ['ﾃﾞ', 'デ'],
  ['ﾄﾞ', 'ド'],
  ['ﾊﾞ', 'バ'],
  ['ﾋﾞ', 'ビ'],
  ['ﾌﾞ', 'ブ'],
  ['ﾍﾞ', 'ベ'],
  ['ﾎﾞ', 'ボ'],
  ['ﾊﾟ', 'パ'],
  ['ﾋﾟ', 'ピ'],
  ['ﾌﾟ', 'プ'],
  ['ﾍﾟ', 'ペ'],
  ['ﾎﾟ', 'ポ'],
  ['ｳﾞ', 'ヴ'],
  ['ﾜﾞ', 'ヷ'],
  ['ｦﾞ', 'ヺ'],
  ['ｱ', 'ア'],
  ['ｲ', 'イ'],
  ['ｳ', 'ウ'],
  ['ｴ', 'エ'],
  ['ｵ', 'オ'],
  ['ｶ', 'カ'],
  ['ｷ', 'キ'],
  ['ｸ', 'ク'],
  ['ｹ', 'ケ'],
  ['ｺ', 'コ'],
  ['ｻ', 'サ'],
  ['ｼ', 'シ'],
  ['ｽ', 'ス'],
  ['ｾ', 'セ'],
  ['ｿ', 'ソ'],
  ['ﾀ', 'タ'],
  ['ﾁ', 'チ'],
  ['ﾂ', 'ツ'],
  ['ﾃ', 'テ'],
  ['ﾄ', 'ト'],
  ['ﾅ', 'ナ'],
  ['ﾆ', 'ニ'],
  ['ﾇ', 'ヌ'],
  ['ﾈ', 'ネ'],
  ['ﾉ', 'ノ'],
  ['ﾊ', 'ハ'],
  ['ﾋ', 'ヒ'],
  ['ﾌ', 'フ'],
  ['ﾍ', 'ヘ'],
  ['ﾎ', 'ホ'],
  ['ﾏ', 'マ'],
  ['ﾐ', 'ミ'],
  ['ﾑ', 'ム'],
  ['ﾒ', 'メ'],
  ['ﾓ', 'モ'],
  ['ﾔ', 'ヤ'],
  ['ﾕ', 'ユ'],
  ['ﾖ', 'ヨ'],
  ['ﾗ', 'ラ'],
  ['ﾘ', 'リ'], 
  ['ﾙ', 'ル'],
  ['ﾚ', 'レ'], 
  ['ﾛ', 'ロ'],
  ['ﾜ', 'ワ'],
  ['ｦ', 'ヲ'],
  ['ﾝ', 'ン'],
  ['ｧ', 'ァ'],
  ['ｨ', 'ィ'], 
  ['ｩ', 'ゥ'],
  ['ｪ', 'ェ'],
  ['ｫ', 'ォ'],
  ['ｯ', 'ッ'],
  ['ｬ', 'ャ'],
  ['ｭ', 'ュ'],
  ['ｮ', 'ョ'],
]);

export const han2ZenkakuKana = (target: string) => {
  const buffer: string[] = [];
  for (const char of target) {
    buffer.push(kanjiNum.get(char) || char);
  }
  
  return buffer.join('');
};

export const han2ZenkakuKanaForCharNode = (target: CharNode | undefined) => {
  let head: CharNode | undefined = target;
  const root = target;
  while (head && head.char) {
    head.char = kanjiNum.get(head.char) || head.char;
    head = head.next;
  }
  return root;
};
