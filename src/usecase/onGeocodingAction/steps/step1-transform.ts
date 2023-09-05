import { Transform, TransformCallback } from 'node:stream';
import { RegExpEx } from '../../../domain';
import {
  ALPHA_NUMERIC_SYMBOLS,
  DASH,
  DASH_SYMBOLS,
  NUMRIC_AND_KANJI_SYMBOLS,
  SPACE,
  SPACE_SYMBOLS,
} from '../../../domain/constantValues';
import { Query } from '../query.class';

export class NormalizeStep1 extends Transform {
  constructor() {
    super({
      objectMode: true,
    });
  }

  private zenkakuToHankaku(str: string): string {
    // ロジック的に 'Ａ-Ｚａ-ｚ０-９' の順番に依存しているので、
    // ここではコードに直接書く
    const regex = RegExpEx.create('[Ａ-Ｚａ-ｚ０-９]', 'g');
    return str.replace(regex, s => {
      return String.fromCharCode(s.charCodeAt(0) - 0xfee0);
    });
  }

  _transform(
    query: Query,
    encoding: BufferEncoding,
    next: TransformCallback
  ): void {
    //
    // 入力された住所に対して以下の正規化を予め行う。
    //
    // 1. 全角のアラビア英数字（０-９Ａ-Ｚａ-ｚ）を半角英数字(0-9A-Za-z)に置換する
    // 2. 全角スペースを半角スペースに変換s
    // 3. 最初に出てくる `1-` や `五-` のような文字列を町丁目とみなして、それ以前のスペースをすべて削除する。
    //
    // オリジナルコード
    // https://github.com/digital-go-jp/abr-geocoder/blob/a42a079c2e2b9535e5cdd30d009454cddbbca90c/src/engine/normalize.ts#L271-L294
    //
    const modifiedInput = query.tempAddress
      .normalize('NFC')
      .replace(RegExpEx.create(`[${SPACE_SYMBOLS}]+`, 'g'), SPACE)
      .replace(RegExpEx.create(`([${ALPHA_NUMERIC_SYMBOLS}]+)`, 'g'), match => {
        // 全角のアラビア数字は問答無用で半角にする
        return this.zenkakuToHankaku(match);
      })
      .replace(
        RegExpEx.create(
          `([${NUMRIC_AND_KANJI_SYMBOLS}][${DASH_SYMBOLS}])|([${DASH_SYMBOLS}])[${NUMRIC_AND_KANJI_SYMBOLS}]`,
          'g'
        ),
        match => {
          return match.replace(
            RegExpEx.create(`[${DASH_SYMBOLS}]`, 'g'),
            DASH
          );
        }
      )
      .replace(
        RegExpEx.create('(.+)(丁目?|番(町|地|丁)|条|軒|線|(の|ノ)町|地割)'),
        match => {
          return match.replace(RegExpEx.create('s', 'g'), ''); // 町丁目名以前のスペースはすべて削除
        }
      )
      .replace(
        RegExpEx.create('(.+)((郡.+(町|村))|((市|巿).+(区|區)))'),
        match => {
          return match.replace(RegExpEx.create('s', 'g'), ''); // 区、郡以前のスペースはすべて削除
        }
      )
      .replace(
        RegExpEx.create(`.+?[${NUMRIC_AND_KANJI_SYMBOLS}]${DASH}`),
        match => {
          return match.replace(RegExpEx.create('s', 'g'), ''); // 1番はじめに出てくるアラビア数字以前のスペースを削除
        }
      );

    console.log(`${query.input} => ${modifiedInput}`);
    next(
      null,
      query.copy({
        tempAddress: modifiedInput,
      })
    );
  }
}
