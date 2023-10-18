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
import { Query } from '@domain/query';
import { RegExpEx } from '@domain/reg-exp-ex';
import {
  ALPHA_NUMERIC_SYMBOLS,
  DASH,
  DASH_SYMBOLS,
  J_DASH,
  NUMRIC_AND_KANJI_SYMBOLS,
  SPACE,
  SPACE_SYMBOLS,
} from '@settings/constant-values';
import { Transform, TransformCallback } from 'node:stream';

export class GeocodingStep1 extends Transform {
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
    let tempAddress = query.tempAddress.normalize('NFC');

    tempAddress = tempAddress.replace(
      RegExpEx.create(`[${SPACE_SYMBOLS}]+`, 'g'),
      SPACE
    );
    tempAddress = tempAddress.replace(
      RegExpEx.create(`([${ALPHA_NUMERIC_SYMBOLS}]+)`, 'g'),
      match => {
        // 全角のアラビア数字は問答無用で半角にする
        return this.zenkakuToHankaku(match);
      }
    );

    tempAddress = tempAddress.replace(
      RegExpEx.create(
        `([${NUMRIC_AND_KANJI_SYMBOLS}][${DASH_SYMBOLS}])|([${DASH_SYMBOLS}])[${NUMRIC_AND_KANJI_SYMBOLS}]`,
        'g'
      ),
      match => {
        return match.replace(RegExpEx.create(`[${DASH_SYMBOLS}]`, 'g'), DASH);
      }
    );
    tempAddress = tempAddress.replace(
      RegExpEx.create(`(.+)(丁目?|番(町|地|丁)|条|軒|線|(${J_DASH})町|地割)`),
      match => {
        // 町丁目名以前のスペースはすべて削除
        return match.replace(RegExpEx.create(SPACE, 'g'), '');
      }
    );

    tempAddress = tempAddress.replace(
      RegExpEx.create('(.+)((郡.+(町|村))|((市|巿).+(区|區)))'),
      match => {
        // 区、郡以前のスペースはすべて削除
        return match.replace(RegExpEx.create(SPACE, 'g'), '');
      }
    );

    tempAddress = tempAddress.replace(
      RegExpEx.create(`.+?[${NUMRIC_AND_KANJI_SYMBOLS}]${DASH}`),
      match => {
        // 1番はじめに出てくるアラビア数字以前のスペースを削除
        return match.replace(RegExpEx.create(SPACE, 'g'), '');
      }
    );

    next(
      null,
      query.copy({
        tempAddress,
      })
    );
  }
}
