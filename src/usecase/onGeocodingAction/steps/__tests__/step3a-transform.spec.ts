import { describe, expect, it, jest } from '@jest/globals';
import Stream, { TransformCallback } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { getCityPatternsForEachPrefecture } from '../../getCityPatternsForEachPrefecture';
import { Query } from '../../query.class';
import { FromStep3Type, FromStep3aType, PrefectureName } from '../../types';
import { GeocodingStep3A } from '../step3a-transform';
import { dummyPrefectures } from './dummyPrefectures';
import { WritableStreamToArray } from './stream-to-array';

describe('step3a-transform', () => {
  const cityPatternsForEachPrefecture =
    getCityPatternsForEachPrefecture(dummyPrefectures);

  const doTest = async (
    input: Query,
    callback: TransformCallback
  ): Promise<FromStep3aType[]> => {
    const outputWrite = new WritableStreamToArray<FromStep3aType>();
    const fromStep3: FromStep3Type = {
      query: input,
      callback,
    };
    const target = new GeocodingStep3A(cityPatternsForEachPrefecture);
    await pipeline(
      Stream.Readable.from([fromStep3], {
        objectMode: true,
      }),
      target,
      outputWrite
    );
    return outputWrite.toArray();
  };

  it('複数の都道府県名にマッチする場合は、step3bに進む', async () => {
    const input = Query.create('府中市宮西町2丁目24番地');
    const results = await doTest(input, jest.fn());

    // 1クエリしかないので length = 1
    expect(results.length).toBe(1);

    // 東京都府中市と広島県府中市にマッチする
    expect(results[0].matchedPatterns).toEqual([
      {
        prefecture: PrefectureName.TOKYO,
        city: '府中市',
        tempAddress: '宮西町2丁目24番地',
      },
      {
        prefecture: PrefectureName.HIROSHIMA,
        city: '府中市',
        tempAddress: '宮西町2丁目24番地',
      },
    ]);
  });

  it('複数の広島市にマッチする場合は、step3bに進む', async () => {
    const input = Query.create('広島市佐伯区海老園二丁目5番28号');
    const results = await doTest(input, jest.fn());

    // 1クエリしかないので length = 1
    expect(results.length).toBe(1);

    // 広島市佐伯区 と 広島市 にマッチするはず
    expect(results[0].matchedPatterns).toEqual([
      {
        prefecture: PrefectureName.HIROSHIMA,
        city: '広島市佐伯区',
        tempAddress: '海老園二丁目5番28号',
      },
      {
        prefecture: PrefectureName.HIROSHIMA,
        city: '広島市',
        tempAddress: '佐伯区海老園二丁目5番28号',
      },
    ]);
  });

  it('都道府県名に１つだけマッチする場合は step4に進む', async () => {
    // 広島市 にマッチするはず
    const step3finish = jest.fn();
    const results = await doTest(Query.create('八幡市八幡園内75'), step3finish);

    // step3finish が呼ばれているはず
    expect(step3finish).toHaveBeenCalledWith(
      null,
      Query.create('八幡市八幡園内75').copy({
        prefecture: PrefectureName.KYOTO,
        city: '八幡市',
        tempAddress: '八幡園内75',
      })
    );
  });
});
