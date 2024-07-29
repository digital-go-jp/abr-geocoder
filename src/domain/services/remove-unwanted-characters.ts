import { RegExpEx } from "./reg-exp-ex";

export const removeUnwantedCharacters = (value: string, replaceValue: string): string => {
    // 日本語の漢字、ひらがな、カタカナ、全角アルファベット、全角数字、全角記号を残し
    // 文字化け、絵文字などの非標準文字を削除
    //
    // U+0000～U+007F: US-ASCII と同一
    // U+2000～U+206F: 一般句読点
    // U+2212: 数学演算子の "−"
    // U+2500～U+257F: 罫線素片
    // U+3000～U+303F: 句読点等
    // U+3040～U+309F: 平仮名、濁点・半濁点
    // U+30A0～U+30FF: 片仮名
    // U+3400～U+4DBF: 拡張漢字
    // U+4E00～U+9FFC: 漢字
    // U+F900～U+FAFF: IBM拡張漢字、拡張漢字
    // U+FF00～U+FFEF: 半角片仮名、全角英数字等
    return value.replaceAll(
      RegExpEx.create(`[^\u0020-\u007E\u2000-\u206F\u2212\u2500-\u257F\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]+`, 'g'),
      replaceValue,
    );
};