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
import oldKanji_to_newKanji_table from '@settings/jis-kanji-table';
/*
 * オリジナルコード
 * https://github.com/digital-go-jp/abr-geocoder/blob/a42a079c2e2b9535e5cdd30d009454cddbbca90c/src/engine/lib/dict.ts#L1-L23
 */
export class JisKanji {
  private JIS_KANJI_MAP: Map<string, number>;
  private PATTERN_MAP: string[] = [];

  private constructor() {
    this.JIS_KANJI_MAP = new Map();

    for (const [oldKanji, newKanji] of Object.entries(
      oldKanji_to_newKanji_table
    )) {
      const result = `(${oldKanji}|${newKanji})`;
      this.JIS_KANJI_MAP.set(oldKanji, this.PATTERN_MAP.length);
      this.JIS_KANJI_MAP.set(newKanji, this.PATTERN_MAP.length);
      this.PATTERN_MAP.push(result);
    }
  }

  replaceAll(target: string): string {
    const results: String[] = [];
    for (const char of target) {
      const resultIdx = this.JIS_KANJI_MAP.get(char)!;
      if (resultIdx === undefined) {
        results.push(char);
        continue;
      }
      results.push(this.PATTERN_MAP[resultIdx]);
    }
    return results.join('');
  }

  private static instnace: JisKanji = new JisKanji();

  static replaceAll(target: string): string {
    return JisKanji.instnace.replaceAll(target);
  }
}

export const jisKanji = (target: string): string => {
  return JisKanji.replaceAll(target);
};
