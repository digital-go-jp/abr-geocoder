import { describe, expect, it } from '@jest/globals';
import Stream from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { PrefectureName, Query } from '../../../domain';
import { AddressFinderForStep7 } from '../../../usecase/geocoder/__mocks__/AddressFinderForStep7';
import { GeocodingStep7 } from '../step7-transform';
import { WritableStreamToArray } from './stream-to-array.skip';

jest.mock('../../../usecase/geocoder/AddressFinderForStep7');

describe('step7-transform', () => {
  const outputWrite = new WritableStreamToArray<Query>();
  const source = [
    Query.create('東京都千代田区紀尾井町どこか').copy({
      prefecture: PrefectureName.TOKYO,
      city: '千代田区',
      town: '紀尾井町',
      tempAddress: 'どこか'
    }),

    Query.create('東京都どこか').copy({
      prefecture: PrefectureName.TOKYO,
      tempAddress: 'どこか'
    }),
  ];

  const finder = new AddressFinderForStep7();
  const target = new GeocodingStep7(finder);

  beforeAll(async () => {
    await pipeline(
      Stream.Readable.from(source, {
        objectMode: true,
      }),
      target,
      outputWrite
    );
  })

  it('addressFinder.find()から正常に返されるケース', async () => {
    const results = outputWrite.toArray();
    expect(results.length).toBe(source.length);
    expect(results[0]).toEqual(source[0]);
    expect(finder.find).toBeCalledWith(source[0]);
  });
  it('townがないので、スキップするケース', async () => {
    const results = outputWrite.toArray();
    expect(results.length).toBe(source.length);
    expect(results[1]).toEqual(source[1]);
    expect(finder.find).not.toBeCalledWith(source[1]);
  });
});
