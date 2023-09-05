import { Transform, TransformCallback } from 'node:stream';
import { RegExpEx } from '../../../domain';
import { Query } from '../query.class';
import { IAddressPatch } from '../types';

export class NormalizeStep6 extends Transform {
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
    // 補正処理？
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
