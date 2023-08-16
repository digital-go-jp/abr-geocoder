import { Transform } from "node:stream";
import { TransformCallback } from "stream";

/**
 * - コメント行 (# で始まる)は排除
 * - 全角スペースを全て半角に変換
 * - 全角英数字を全て半角に変換
 * - その他、処理をし易いように変換する
 */
export class JPAddressNormalizer extends Transform {

  private readonly convertToHankaku: (query: string) => string;

  constructor({
    convertToHankaku,
  }: {
    convertToHankaku: (query: string) => string,
  }) {
    super();
    this.convertToHankaku = convertToHankaku;

    Object.freeze(this);
  }

  _transform(
    line: string,
    encoding: BufferEncoding,
    next: TransformCallback,
  ): void {
    // Ignore comment line
    if (line.startsWith('#')) {
      next();
      return;
    }

    const address = line.normalize('NFC')
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
    
    next(null, address);
  }


}