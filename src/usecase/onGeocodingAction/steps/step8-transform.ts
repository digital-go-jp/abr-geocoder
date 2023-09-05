import { Transform, TransformCallback } from 'node:stream';
import { RegExpEx } from '../../../domain';
import { DASH, SPACE } from '../../../domain/constantValues';
import { Query } from '../query.class';

export class GeocodingStep8 extends Transform {
  constructor() {
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
    // {SPACE}, {DASH} をもとに戻す
    //
    query = query.copy({
      tempAddress: this.restore(query.tempAddress),
    });

    callback(null, query);
  }

  private restore(address: string): string {
    return address
      .replace(RegExpEx.create(DASH, 'g'), '-')
      .replace(RegExpEx.create(SPACE, 'g'), ' ');
  }
}
