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

import { CharNode } from "@usecases/geocode/models/trie/char-node";

const katakanaMap = new Map<string, string>([
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
  ['ﾜﾞ', 'ヴ'],
  ['ｦﾞ', 'ヲ'],
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
  ['ｧ', 'ア'],
  ['ｨ', 'イ'],
  ['ｩ', 'ウ'],
  ['ｪ', 'エ'],
  ['ｫ', 'オ'],
  ['ｯ', 'ツ'],
  ['ｬ', 'ヤ'],
  ['ｭ', 'ユ'],
  ['ｮ', 'ヨ'],
  ['ガ', 'ガ'],
  ['ギ', 'ギ'],
  ['グ', 'グ'],
  ['ゲ', 'ゲ'],
  ['ゴ', 'ゴ'],
  ['ザ', 'ザ'],
  ['ジ', 'ジ'],
  ['ズ', 'ズ'],
  ['ゼ', 'ゼ'],
  ['ゾ', 'ゾ'],
  ['ダ', 'ダ'],
  ['ヂ', 'ヂ'],
  ['ヅ', 'ヅ'],
  ['デ', 'デ'],
  ['ド', 'ド'],
  ['バ', 'バ'],
  ['ビ', 'ビ'],
  ['ブ', 'ブ'],
  ['ベ', 'ベ'],
  ['ボ', 'ボ'],
  ['パ', 'パ'],
  ['ピ', 'ピ'],
  ['プ', 'プ'],
  ['ㇷ゚', 'プ'],  // 捨て仮名
  ['ペ', 'ペ'],
  ['ポ', 'ポ'],
  ['ヴ', 'ヴ'],
  ['ヷ', 'ヴ'],
  ['ヺ', 'ヲ'],
  ['ぁ', 'ア'],  // 捨て仮名
  ['ァ', 'ア'],  // 捨て仮名
  ['ア', 'ア'], 
  ['ぃ', 'イ'],  // 捨て仮名
  ['ィ', 'イ'],  // 捨て仮名
  ['イ', 'イ'],
  ['ぅ ', 'ウ'],  // 捨て仮名
  ['ゥ', 'ウ'],  // 捨て仮名
  ['ウ', 'ウ'],
  ['ぇ', 'エ'],  // 捨て仮名
  ['ェ', 'エ'],  // 捨て仮名
  ['ヱ', 'エ'],  // 片仮名
  ['ゑ', 'エ'],  // 平仮名
  ['エ', 'エ'],
  ['オ', 'オ'],
  ['ぉ', 'オ'],  // 捨て仮名
  ['ォ', 'オ'],  // 捨て仮名
  ['ゕ', 'カ'],  // 捨て仮名
  ['ヵ', 'カ'],  // 捨て仮名
  ['カ', 'カ'],
  ['キ', 'キ'],
  ['ク', 'ク'],
  ['ㇰ', 'ク'],  // 捨て仮名
  ['ケ', 'ガ'],
  ['ヶ', 'ガ'],  // 捨て仮名
  ['ゖ', 'ガ'],  // 捨て仮名
  ['コ', 'コ'],
  ['サ', 'サ'],
  ['シ', 'シ'],
  ['ㇱ', 'シ'],  // 捨て仮名
  ['ス', 'ス'],
  ['ㇲ', 'ス'],  // 捨て仮名
  ['セ', 'セ'],
  ['ソ', 'ソ'],
  ['タ', 'タ'],
  ['チ', 'チ'],
  ['ツ', 'ツ'],
  ['っ', 'ツ'],  // 捨て仮名
  ['ッ', 'ツ'],  // 捨て仮名
  ['テ', 'テ'],
  ['ト', 'ト'],
  ['ㇳ', 'ト'],  // 捨て仮名
  ['ナ', 'ナ'],
  ['ニ', 'ニ'],
  ['ヌ', 'ヌ'],
  ['ㇴ', 'ヌ'],  // 捨て仮名
  ['ネ', 'ネ'],
  ['ノ', 'ノ'],  // 片仮名
  ['丿', 'ノ'],  // 片仮名
  ['ハ', 'ハ'],
  ['ㇵ', 'ハ'],  // 捨て仮名
  ['ヒ', 'ヒ'],
  ['ㇶ', 'ヒ'],  // 捨て仮名
  ['フ', 'フ'],
  ['ㇷ', 'フ'],  // 捨て仮名
  ['ヘ', 'ヘ'],
  ['ㇸ', 'ヘ'],  // 捨て仮名
  ['ホ', 'ホ'],
  ['ㇹ', 'ホ'],  // 捨て仮名
  ['マ', 'マ'],
  ['ミ', 'ミ'],
  ['ム', 'ム'],
  ['ㇺ', 'ム'],  // 捨て仮名
  ['メ', 'メ'],
  ['モ', 'モ'],
  ['ヤ', 'ヤ'],
  ['ゃ', 'ヤ'],  // 捨て仮名
  ['ャ', 'ヤ'],  // 捨て仮名
  ['ユ', 'ユ'],
  ['ゅ', 'ユ'],  // 捨て仮名
  ['ュ', 'ユ'],  // 捨て仮名
  ['ヨ', 'ヨ'],
  ['ょ', 'ヨ'],  // 捨て仮名
  ['ョ', 'ヨ'],  // 捨て仮名
  ['ラ', 'ラ'],
  ['ㇻ', 'ラ'],  // 捨て仮名
  ['リ', 'リ'],
  ['ㇼ', 'リ'],  // 捨て仮名
  ['ル', 'ル'],
  ['ㇽ', 'ル'],  // 捨て仮名
  ['レ', 'レ'],
  ['ㇾ', 'レ'],  // 捨て仮名
  ['ロ', 'ロ'],
  ['ㇿ', 'ロ'],  // 捨て仮名
  ['ゎ', 'ワ'],  // 捨て仮名
  ['ワ', 'ワ'],
  ['ヮ', 'ワ'],  // 捨て仮名
  ['ヲ', 'ヲ'],
  ['ン', 'ン'],
  ['之', 'ノ'],  // 堀之内 → 堀ノ内
]);

export const toKatakana = <T extends string | CharNode | undefined>(target: T): T => {
  if (target === undefined) {
    return undefined as T;
  }
  if (typeof target === 'string') {
    const buffer: string[] = [];
    for (const char of target) {
      buffer.push(katakanaMap.get(char) || char);
    }
    
    return buffer.join('') as T;
  }
  if (target instanceof CharNode) {
    return toKatakanaForCharNode(target) as T;
  }
  throw `unsupported value type`;
};

const toKatakanaForCharNode = (target: CharNode | undefined): CharNode | undefined => {
  let head = target;
  const root = target;
  while (head && head.char) {
    head.char = katakanaMap.get(head.char) || head.char;
    head = head.next;
  }
  return root;
};
