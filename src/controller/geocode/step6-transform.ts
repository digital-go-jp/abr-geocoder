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
import { IAddressPatch } from '@domain/iaddress-patch';
import { Query } from '@domain/query';
import { RegExpEx } from '@domain/reg-exp-ex';
import { Transform, TransformCallback } from 'node:stream';

export class GeocodingStep6 extends Transform {
  constructor(private readonly addressPatches: IAddressPatch[]) {
    super({
      objectMode: true,
    });
  }

  _transform(
    query: Query,
    encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    //
    // 個別ケースの補正処理
    //
    // オリジナルコード
    // https://github.com/digital-go-jp/abr-geocoder/blob/a42a079c2e2b9535e5cdd30d009454cddbbca90c/src/engine/lib/patchAddr.ts#L25-L40
    //

    let address = query.tempAddress;
    this.addressPatches.forEach(patch => {
      if (
        patch.prefecture !== query.prefecture ||
        patch.city !== query.city ||
        patch.town !== query.town
      ) {
        return;
      }

      address = address.replace(
        RegExpEx.create(patch.regExpPattern),
        patch.result
      );
    });

    callback(
      null,
      query.copy({
        tempAddress: address,
      })
    );
  }
}
