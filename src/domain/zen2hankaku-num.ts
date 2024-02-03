/*!
 * MIT License
 *
 * Copyright (c) 2023 デジタル庁
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
const zenkakuHankakuMap = new Map<string, string>([
  ['Ａ', 'A'],
  ['Ｂ', 'B'],
  ['Ｃ', 'C'],
  ['Ｄ', 'D'],
  ['Ｅ', 'E'],
  ['Ｆ', 'F'],
  ['Ｇ', 'G'],
  ['Ｈ', 'H'],
  ['Ｉ', 'I'],
  ['Ｊ', 'J'],
  ['Ｋ', 'K'],
  ['Ｌ', 'L'],
  ['Ｍ', 'M'],
  ['Ｎ', 'N'],
  ['Ｏ', 'O'],
  ['Ｐ', 'P'],
  ['Ｑ', 'Q'],
  ['Ｒ', 'R'],
  ['Ｓ', 'S'],
  ['Ｔ', 'T'],
  ['Ｕ', 'U'],
  ['Ｖ', 'V'],
  ['Ｗ', 'W'],
  ['Ｘ', 'X'],
  ['Ｙ', 'Y'],
  ['Ｚ', 'Z'],
  ['ａ', 'a'],
  ['ｂ', 'b'],
  ['ｃ', 'c'],
  ['ｄ', 'd'],
  ['ｅ', 'e'],
  ['ｆ', 'f'],
  ['ｇ', 'g'],
  ['ｈ', 'h'],
  ['ｉ', 'i'],
  ['ｊ', 'j'],
  ['ｋ', 'k'],
  ['ｌ', 'l'],
  ['ｍ', 'm'],
  ['ｎ', 'n'],
  ['ｏ', 'o'],
  ['ｐ', 'p'],
  ['ｑ', 'q'],
  ['ｒ', 'r'],
  ['ｓ', 's'],
  ['ｔ', 't'],
  ['ｕ', 'u'],
  ['ｖ', 'v'],
  ['ｗ', 'w'],
  ['ｘ', 'x'],
  ['ｙ', 'y'],
  ['ｚ', 'z'],
  ['０', '0'],
  ['１', '1'],
  ['２', '2'],
  ['３', '3'],
  ['４', '4'],
  ['５', '5'],
  ['６', '6'],
  ['７', '7'],
  ['８', '8'],
  ['９', '9'],
]);
export const zen2HankakuNum = (str: string): string => {
  // ロジック的に 'Ａ-Ｚａ-ｚ０-９' の順番に依存しているので、
  // ここではコードに直接書く
  const buffer: string[] = [];
  for (const char of str) {
    buffer.push(zenkakuHankakuMap.get(char) || char);
  }
  return buffer.join('');
};
