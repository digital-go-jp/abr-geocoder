import { describe, expect, it, jest } from '@jest/globals';
import Stream from "node:stream";
import { pipeline } from 'node:stream/promises';
import { getCityPatternsForEachPrefecture } from '../../getCityPatternsForEachPrefecture';
import { Query } from "../../query.class";
import { FromStep3Type, PrefectureName, Step3aMatchedPatternType } from "../../types";
import { NormalizeStep3a } from '../step3a-transform';
import { dummyPrefectures } from './dummyPrefectures';
import { WritableStreamToArray } from './stream-to-array';

describe('step3a-transform', () => {
  const cityPatternsForEachPrefecture = getCityPatternsForEachPrefecture(dummyPrefectures);
  
  it('複数の都道府県名にマッチする場合は、step3bに進む', async () => {
    // 越後県越後市 と 陸奥県越後市 にマッチする
    const dummyData = Query.create(`越後市どこか`);
    const dummyCallback = jest.fn();
    const expectMatchedPatterns: Step3aMatchedPatternType[] = [
      {
        prefecture: '越後県' as PrefectureName,
        city: '越後市',
        input: 'どこか'
      },
      {
        prefecture: '陸奥県' as PrefectureName,
        city: '越後市',
        input: 'どこか'
      }
    ];

    const target = new NormalizeStep3a(cityPatternsForEachPrefecture);
    const outputWrite = new WritableStreamToArray<Query>();

    const fromStep3: FromStep3Type = {
      query: dummyData,
      callback: dummyCallback,
    };
    await pipeline(
      Stream.Readable.from([fromStep3], {
        objectMode: true,
      }),
      target,
      outputWrite
    );
    
    const actualValues = outputWrite.toArray();
    expect(actualValues.length).toBe(1);
    expect(actualValues[0]).toEqual({
      fromStep3,
      matchedPatterns: expectMatchedPatterns
    })

  });

  it('都道府県名に１つだけマッチする場合は step4に進む', async () => {
    const dummyData = Query.create(`弥彦村どこか`);
    const dummyCallback = jest.fn();

    const target = new NormalizeStep3a(cityPatternsForEachPrefecture);
    const outputWrite = new WritableStreamToArray<Query>();

    await pipeline(
      Stream.Readable.from([
        {
          query: dummyData,
          callback: dummyCallback,
        },
      ], {
        objectMode: true,
      }),
      target,
      outputWrite
    );
    
    // step4に渡されるデータが期待値と一致することを確認
    expect(dummyCallback).toHaveBeenCalledWith(
      null,
      Query.create('弥彦村どこか').copy({
        prefectureName: '越後県' as PrefectureName,
        city: '弥彦村',
      }),
    );

  });
});
