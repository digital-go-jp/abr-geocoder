import { IAddressPatch } from '@domain/iaddress-patch';
import { PrefectureName } from '@domain/prefecture-name';
import { Query } from '@domain/query';
import { describe, expect, it } from '@jest/globals';
import Stream from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { GeocodingStep6 } from '../step6-transform';
import { WritableStreamToArray } from './stream-to-array.skip';

const createWriteStream = () => {
  return new WritableStreamToArray<Query>();
};

const createTestTarget = () => {
  const patchPatterns: IAddressPatch[] = [
    {
      prefecture: PrefectureName.TOKYO,
      city: '千代田区',
      town: '紀尾井町',
      regExpPattern: '^デジ(?:タル)?庁',
      result: '1-3 東京ガーデンテラス紀尾井町 19階、20階',
    },
  ];
  return new GeocodingStep6(patchPatterns);
}

describe('step6-transform', () => {

  it.concurrent('不完全な住所を正規表現で補正する', async () => {
    const dummyData1 = Query.create('東京都千代田区紀尾井町デジ庁').copy({
      prefecture: PrefectureName.TOKYO,
      city: '千代田区',
      town: '紀尾井町',
      lg_code: '131016',
      town_id: '0056000',
      tempAddress: 'デジ庁'
    });
    const outputWrite = createWriteStream();
    const target = createTestTarget();
    
    await pipeline(
      Stream.Readable.from([
        dummyData1,
      ], {
        objectMode: true,
      }),
      target,
      outputWrite
    );

    const results = outputWrite.toArray();
    expect(results.length).toBe(1);
    expect(results[0]).toEqual(Query.create('東京都千代田区紀尾井町デジ庁').copy({
      prefecture: PrefectureName.TOKYO,
      city: '千代田区',
      town: '紀尾井町',
      lg_code: '131016',
      town_id: '0056000',
      tempAddress: '1-3 東京ガーデンテラス紀尾井町 19階、20階'
    }));
  });
});
