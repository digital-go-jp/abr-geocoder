import {Transform} from 'node:stream';
import {TransformCallback} from 'stream';
import {SpecialPattern} from './types';

/**
 * - コメント行 (# で始まる)は排除
 * - 全角スペースを全て半角に変換
 * - 全角英数字を全て半角に変換
 * - その他、処理をし易いように変換する
 */
export class JPAddressNormalizer extends Transform {
  private readonly convertToHankaku: (query: string) => string;
  private readonly specialPatternsWithRegExp: [string, RegExp][] = [];

  constructor({
    convertToHankaku,
    specialPatterns = [],
    fuzzy,
  }: {
    convertToHankaku: (query: string) => string;
    specialPatterns: SpecialPattern[];
    fuzzy?: string;
  }) {
    super();
    this.convertToHankaku = convertToHankaku;

    this.specialPatternsWithRegExp = specialPatterns.map(pattern => {
      return [
        // 正しい住所表記
        pattern[0],

        // 置き換えるための正規表現パターン
        new RegExp(
          fuzzy ? this.insertWildcardMatching(pattern[1]) : pattern[1]
        ),
      ];
    });
  }

  /**
   * string = "^愛知郡愛荘町" を  "^(愛|\\?)(知|\\?)(郡|\\?)(愛|\\?)(荘|\\?)(町|\\?)" にする
   */
  private insertWildcardMatching = (string: string) => {
    return string.replace(
      /(?<!\[[^\]]*)([一-龯ぁ-んァ-ン])(?!\?)/g,
      '($1|\\?)'
    );
  };

  _transform(
    line: string,
    encoding: BufferEncoding,
    next: TransformCallback
  ): void {
    line = line.toString().trim();

    // コメント行は無視する
    if (line.startsWith('#') || line.startsWith('//')) {
      next();
      return;
    }

    let address = line
      .normalize('NFC')
      .replace(/\u3000/g, ' ') // \u3000 which is an invisible space in Zenkaku
      .replace(/\s+/g, ' ')
      .replace(/([０-９Ａ-Ｚａ-ｚ]+)/g, match => {
        // 全角のアラビア数字は問答無用で半角にする
        return this.convertToHankaku(match);
      })
      .replace(
        /([0-9０-９一二三四五六七八九〇十百千][-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━])|([-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━])[0-9０-９一二三四五六七八九〇十]/g,
        match => {
          return match.replace(/[-－﹣−‐⁃‑‒–—﹘―⎯⏤ーｰ─━]/g, '-');
        }
      )
      .replace(/(.+)(丁目?|番(町|地|丁)|条|軒|線|(の|ノ)町|地割)/, match => {
        return match.replace(/\s/g, ''); // 町丁目名以前のスペースはすべて削除
      })
      .replace(/(.+)((郡.+(町|村))|((市|巿).+(区|區)))/, match => {
        return match.replace(/\s/g, ''); // 区、郡以前のスペースはすべて削除
      })
      .replace(/.+?[0-9一二三四五六七八九〇十百千]-/, match => {
        return match.replace(/\s/g, ''); // 1番はじめに出てくるアラビア数字以前のスペースを削除
      });

    // 県名が省略されており、かつ市の名前がどこかの都道府県名と同じ場合(例.千葉県千葉市)、
    // あらかじめ県名を補完しておく。
    for (const [correctAddess, regExp] of this.specialPatternsWithRegExp) {
      const match = address.match(regExp);
      if (!match) {
        continue;
      }
      address = address.replace(match[0], correctAddess);
      break;
    }

    next(null, address);
  }
}
