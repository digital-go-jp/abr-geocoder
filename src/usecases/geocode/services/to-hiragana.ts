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

const hiraganaMap = new Map<string, string>([
  ['ｶﾞ', 'が'],
  ['ｷﾞ', 'ぎ'],
  ['ｸﾞ', 'ぐ'],
  ['ｹﾞ', 'げ'],
  ['ｺﾞ', 'ご'],
  ['ｻﾞ', 'ざ'],
  ['ｼﾞ', 'じ'],
  ['ｽﾞ', 'ず'],
  ['ｾﾞ', 'ぜ'],
  ['ｿﾞ', 'ぞ'],
  ['ﾀﾞ', 'だ'],
  ['ﾁﾞ', 'ぢ'],
  ['ﾂﾞ', 'づ'],
  ['ﾃﾞ', 'で'],
  ['ﾄﾞ', 'ど'],
  ['ﾊﾞ', 'ば'],
  ['ﾋﾞ', 'び'],
  ['ﾌﾞ', 'ぶ'],
  ['ﾍﾞ', 'べ'],
  ['ﾎﾞ', 'ぼ'],
  ['ﾊﾟ', 'ぱ'],
  ['ﾋﾟ', 'ぴ'],
  ['ﾌﾟ', 'ぷ'],
  ['ﾍﾟ', 'ぺ'],
  ['ﾎﾟ', 'ぽ'],
  ['ｳﾞ', 'ゔ'],
  ['ﾜﾞ', 'ゔぁ'],
  ['ｦﾞ', 'ゔぉ'],
  ['ｱ', 'あ'],
  ['ｲ', 'い'],
  ['ｳ', 'う'],
  ['ｴ', 'え'],
  ['ｵ', 'お'],
  ['ｶ', 'か'],
  ['ｷ', 'き'],
  ['ｸ', 'く'],
  ['ｹ', 'け'],
  ['ｺ', 'こ'],
  ['ｻ', 'さ'],
  ['ｼ', 'し'],
  ['ｽ', 'す'],
  ['ｾ', 'せ'],
  ['ｿ', 'そ'],
  ['ﾀ', 'た'],
  ['ﾁ', 'ち'],
  ['ﾂ', 'つ'],
  ['ﾃ', 'て'],
  ['ﾄ', 'と'],
  ['ﾅ', 'な'],
  ['ﾆ', 'に'],
  ['ﾇ', 'ぬ'],
  ['ﾈ', 'ね'],
  ['ﾉ', 'の'],
  ['ﾊ', 'は'],
  ['ﾋ', 'ひ'],
  ['ﾌ', 'ふ'],
  ['ﾍ', 'へ'],
  ['ﾎ', 'ほ'],
  ['ﾏ', 'ま'],
  ['ﾐ', 'み'],
  ['ﾑ', 'む'],
  ['ﾒ', 'め'],
  ['ﾓ', 'も'],
  ['ﾔ', 'や'],
  ['ﾕ', 'ゆ'],
  ['ﾖ', 'よ'],
  ['ﾗ', 'ら'],
  ['ﾘ', 'り'],
  ['ﾙ', 'る'],
  ['ﾚ', 'れ'],
  ['ﾛ', 'ろ'],
  ['ﾜ', 'わ'],
  ['ｦ', 'を'],
  ['ﾝ', 'ん'],
  ['ｧ', 'あ'],
  ['ｨ', 'い'],
  ['ｩ', 'う'],
  ['ｪ', 'え'],
  ['ｫ', 'お'],
  ['ｯ', 'つ'],
  ['ｬ', 'や'],
  ['ｭ', 'ゆ'],
  ['ｮ', 'よ'],
  ['ガ', 'が'],
  ['ギ', 'ぎ'],
  ['グ', 'ぐ'],
  ['ゲ', 'げ'],
  ['ゴ', 'ご'],
  ['ザ', 'ざ'],
  ['ジ', 'じ'],
  ['ズ', 'ず'],
  ['ゼ', 'ぜ'],
  ['ゾ', 'ぞ'],
  ['ダ', 'だ'],
  ['ヂ', 'ぢ'],
  ['ヅ', 'づ'],
  ['デ', 'で'],
  ['ド', 'ど'],
  ['バ', 'ば'],
  ['ビ', 'び'],
  ['ブ', 'ぶ'],
  ['ベ', 'べ'],
  ['ボ', 'ぼ'],
  ['パ', 'ぱ'],
  ['ピ', 'ぴ'],
  ['プ', 'ぷ'],
  ['ㇷ゚', 'ぷ'],  // 捨て仮名
  ['ペ', 'ぺ'],
  ['ポ', 'ぽ'],
  ['ヴ', 'ゔ'],
  ['ヷ', 'ゔぁ'],
  ['ヺ', 'ゔぉ'],
  ['ぁ', 'あ'],  // 捨て仮名
  ['ァ', 'あ'],  // 捨て仮名
  ['ア', 'あ'], 
  ['ぃ', 'い'],  // 捨て仮名
  ['ィ', 'い'],  // 捨て仮名
  ['イ', 'い'],
  ['ぅ ', 'う'],  // 捨て仮名
  ['ゥ', 'う'],  // 捨て仮名
  ['ウ', 'う'],
  ['ぇ', 'え'],  // 捨て仮名
  ['ェ', 'え'],  // 捨て仮名
  ['ヱ', 'え'],  // 片仮名
  ['ゑ', 'え'],  // 平仮名
  ['エ', 'え'],
  ['オ', 'お'],
  ['ぉ', 'お'],  // 捨て仮名
  ['ォ', 'お'],  // 捨て仮名
  ['ゕ', 'か'],  // 捨て仮名
  ['ヵ', 'か'],  // 捨て仮名
  ['カ', 'か'],
  ['キ', 'き'],
  ['ク', 'く'],
  ['ㇰ', 'く'],  // 捨て仮名
  ['ケ', 'が'],
  ['ヶ', 'が'],  // 捨て仮名
  ['ゖ', 'が'],  // 捨て仮名
  ['コ', 'こ'],
  ['サ', 'さ'],
  ['シ', 'し'],
  ['ㇱ', 'し'],  // 捨て仮名
  ['ス', 'す'],
  ['ㇲ', 'す'],  // 捨て仮名
  ['セ', 'せ'],
  ['ソ', 'そ'],
  ['タ', 'た'],
  ['チ', 'ち'],
  ['ツ', 'つ'],
  ['っ', 'つ'],  // 捨て仮名
  ['ッ', 'つ'],  // 捨て仮名
  ['テ', 'て'],
  ['ト', 'と'],
  ['ㇳ', 'と'],  // 捨て仮名
  ['ナ', 'な'],
  ['ニ', 'に'],
  ['ヌ', 'ぬ'],
  ['ㇴ', 'ぬ'],  // 捨て仮名
  ['ネ', 'ね'],
  ['ノ', 'の'],  // 片仮名
  ['丿', 'の'],  // 片仮名
  ['ハ', 'は'],
  ['ㇵ', 'は'],  // 捨て仮名
  ['ヒ', 'ひ'],
  ['ㇶ', 'ひ'],  // 捨て仮名
  ['フ', 'ふ'],
  ['ㇷ', 'ふ'],  // 捨て仮名
  ['ヘ', 'へ'],
  ['ㇸ', 'へ'],  // 捨て仮名
  ['ホ', 'ほ'],
  ['ㇹ', 'ほ'],  // 捨て仮名
  ['マ', 'ま'],
  ['ミ', 'み'],
  ['ム', 'む'],
  ['ㇺ', 'む'],  // 捨て仮名
  ['メ', 'め'],
  ['モ', 'も'],
  ['ヤ', 'や'],
  ['ゃ', 'や'],  // 捨て仮名
  ['ャ', 'や'],  // 捨て仮名
  ['ユ', 'ゆ'],
  ['ゅ', 'ゆ'],  // 捨て仮名
  ['ュ', 'ゆ'],  // 捨て仮名
  ['ヨ', 'よ'],
  ['ょ', 'よ'],  // 捨て仮名
  ['ョ', 'よ'],  // 捨て仮名
  ['ラ', 'ら'],
  ['ㇻ', 'ら'],  // 捨て仮名
  ['リ', 'り'],
  ['ㇼ', 'り'],  // 捨て仮名
  ['ル', 'る'],
  ['ㇽ', 'る'],  // 捨て仮名
  ['レ', 'れ'],
  ['ㇾ', 'れ'],  // 捨て仮名
  ['ロ', 'ろ'],
  ['ㇿ', 'ろ'],  // 捨て仮名
  ['ゎ', 'わ'],  // 捨て仮名
  ['ワ', 'わ'],
  ['ヮ', 'わ'],  // 捨て仮名
  ['ヲ', 'を'],
  ['ン', 'ん'],
  ['之', 'の'],  // 堀之内 → 堀の内
]);

export const toHiragana = (target: string) => {
  const buffer: string[] = [];
  for (const char of target) {
    buffer.push(hiraganaMap.get(char) || char);
  }
  
  return buffer.join('');
};

export const toHiraganaForCharNode = (target: CharNode | undefined): CharNode | undefined => {
  let head = target;
  const root = target;
  while (head && head.char) {
    if (!head.ignore) {
      head.char = hiraganaMap.get(head.char) || head.char;
    }
    head = head.next;
  }
  return root;
};
