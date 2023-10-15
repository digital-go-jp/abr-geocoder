import { describe, expect, it } from '@jest/globals';
import Stream from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Query } from '../../../domain';
import { DASH, SPACE } from '../../../settings/constantValues';
import { GeocodingStep8 } from '../step8-transform';
import { WritableStreamToArray } from './stream-to-array.skip';

describe('step8-transform', () => {
  const outputWrite = new WritableStreamToArray<Query>();
  const source = [
    Query.create(`   ${DASH}111${SPACE}11${SPACE}aa${SPACE}a${DASH} `).copy({
      tempAddress: `   ${DASH}111${SPACE}11${SPACE}aa${SPACE}a${DASH} `,
    }),
  ];

  const target = new GeocodingStep8();

  beforeAll(async () => {
    await pipeline(
      Stream.Readable.from(source, {
        objectMode: true,
      }),
      target,
      outputWrite
    );
  })

  it('DASH, SPACEが正しく置換されるはず', async () => {
    const results = outputWrite.toArray();
    expect(results.length).toBe(source.length);
    expect(results[0]).toEqual(Query.create(`   ${DASH}111${SPACE}11${SPACE}aa${SPACE}a${DASH} `).copy({
      tempAddress: `-111 11 aa a-`,
    }));
  });
});
