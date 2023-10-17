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
