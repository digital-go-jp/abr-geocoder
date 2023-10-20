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
import { RegExpEx } from './reg-exp-ex';
import oldKanji_to_newKanji_table from '@settings/jis-kanji-table';
/*
 * オリジナルコード
 * https://github.com/digital-go-jp/abr-geocoder/blob/a42a079c2e2b9535e5cdd30d009454cddbbca90c/src/engine/lib/dict.ts#L1-L23
 */
export class JisKanji {
  private JIS_KANJI_REGEX_PATTERNS: [regexp: RegExp, replaceTo: string][] = [];

  private constructor() {
    for (const [oldKanji, newKanji] of Object.entries(
      oldKanji_to_newKanji_table
    )) {
      const pattern = `${oldKanji}|${newKanji}`;

      this.JIS_KANJI_REGEX_PATTERNS.push([
        RegExpEx.create(pattern, 'g'),
        `(${oldKanji}|${newKanji})`,
      ]);
    }
  }

  replaceAll(target: string): string {
    for (const [regExp, replaceTo] of this.JIS_KANJI_REGEX_PATTERNS) {
      target = target.replace(regExp, replaceTo);
    }
    return target;
  }

  private static instnace: JisKanji = new JisKanji();

  static replaceAll(target: string): string {
    return JisKanji.instnace.replaceAll(target);
  }
}

export const jisKanji = (target: string): string => {
  return JisKanji.replaceAll(target);
};
