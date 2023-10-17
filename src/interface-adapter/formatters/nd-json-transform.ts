import { Stream } from 'node:stream';
import { GeocodeResult } from '@domain';
import { TransformCallback } from 'stream';

export class NdJsonTransform extends Stream.Transform {
  private constructor() {
    super({
      // Data format coming from the previous stream is object mode.
      // Because we expect GeocodeResult
      writableObjectMode: true,

      // Data format to the next stream is non-object mode.
      // Because we output string as Buffer.
      readableObjectMode: false,
    });
  }

  _transform(
    result: GeocodeResult,
    encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    const jsonStr = JSON.stringify({
      query: {
        input: result.input,
      },
      result: {
        prefecture: result.prefecture?.toString(),
        match_level: result.match_level,
        city: result.city,
        town: result.town,
        town_id: result.town_id,
        lg_code: result.lg_code,
        other: result.other,
        lat: result.lat,
        lon: result.lon,
        block: result.block,
        block_id: result.block_id,
        addr1: result.addr1,
        addr1_id: result.addr1_id,
        addr2: result.addr2,
        addr2_id: result.addr2_id,
      },
    });
    callback(null, `${jsonStr}\n`);
  }

  static create = (): NdJsonTransform => {
    return new NdJsonTransform();
  };
}
