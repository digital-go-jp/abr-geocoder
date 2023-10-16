import { describe, expect, it } from '@jest/globals';
import Stream from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { InterpolatePattern, PrefectureName, Query, MatchLevel } from '../../../domain';
import { GeocodingStep4 } from '../step4-transform';
import { WritableStreamToArray } from './stream-to-array.skip';

describe('step4-transform', () => {

  // Comes from getCityPatternsForEachPrefecture.spec.ts
  const cityPatternsForEachPrefecture = new Map<PrefectureName, InterpolatePattern[]>([
    [PrefectureName.OKINAWA, [
      {
        prefecture: PrefectureName.OKINAWA,
        regExpPattern: '^(八重山郡)?与那国町',
        city: '八重山郡与那国町',
      },
      {
        prefecture: PrefectureName.OKINAWA,
        regExpPattern: '^(八重山郡)?竹富町',
        city: '八重山郡竹富町',
      },
    ]],

    [PrefectureName.HOKKAIDO, [
      {
        prefecture: PrefectureName.HOKKAIDO,
        regExpPattern: '^札幌市中央区',
        city: '札幌市中央区',
      },
      {
        prefecture: PrefectureName.HOKKAIDO,
        regExpPattern: '^札幌市',
        city: '札幌市',
      },
    ]]
  ]);

  it.concurrent('都道府県が不明 or 市町村名がすでに判明している場合はスキップ', async () => {
    const dummyData1 = Query.create('どこか');
    const dummyData2 = Query.create('沖縄県八重山郡竹富町').copy({
      prefecture: PrefectureName.OKINAWA,
      city: '八重山郡竹富町',
    });

    const outputWrite = new WritableStreamToArray<Query>();

    const target = new GeocodingStep4({
      cityPatternsForEachPrefecture,
      wildcardHelper: (txt: string) => txt,
    });
    
    await pipeline(
      Stream.Readable.from([
        dummyData1,
        dummyData2,
      ], {
        objectMode: true,
      }),
      target,
      outputWrite
    );

    const reuslts = outputWrite.toArray();
    expect(reuslts).toEqual([
      dummyData1,
      dummyData2,
    ]);
  });

  it.concurrent('都道府県 or 市町村名がわからない場合', async () => {
    const dummyData1 = Query.create('竹富町のどこか').copy({
      prefecture: PrefectureName.OKINAWA,
    });
    const dummyData2 = Query.create('札幌市中央区のどこか').copy({
      prefecture: PrefectureName.HOKKAIDO,
    });
    const dummyData3 = Query.create('どこかわからない場所').copy({
      prefecture: PrefectureName.HOKKAIDO,
    });

    const outputWrite = new WritableStreamToArray<Query>();

    const target = new GeocodingStep4({
      cityPatternsForEachPrefecture,
      wildcardHelper: (txt: string) => txt,
    });
    await pipeline(
      Stream.Readable.from([
        dummyData1,
        dummyData2,
        dummyData3,
      ], {
        objectMode: true,
      }),
      target,
      outputWrite
    );

    const reuslts = outputWrite.toArray();
    expect(reuslts).toEqual([
      dummyData1.copy({
        city: '八重山郡竹富町',
        match_level: MatchLevel.ADMINISTRATIVE_AREA,
        tempAddress: 'のどこか', // 判定できなかった残り部分
      }),

      dummyData2.copy({
        city: '札幌市中央区',
        match_level: MatchLevel.ADMINISTRATIVE_AREA,
        tempAddress: 'のどこか', // 判定できなかった残り部分
      }),

      // 不明な場所はそのまま
      dummyData3,
    ]);
  });
});
