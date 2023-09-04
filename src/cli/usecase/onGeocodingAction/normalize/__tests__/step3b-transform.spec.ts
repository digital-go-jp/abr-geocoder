import { describe, expect, it, jest } from '@jest/globals';
import Stream from "node:stream";
import { pipeline } from 'node:stream/promises';
import { AddressFinder, FindParameters } from '../../AddressFinder';
import { Query } from "../../query.class";
import { FromStep3Type, ITown, PrefectureName, Step3aMatchedPatternType } from "../../types";
import { NormalizeStep3b } from '../step3b-transform';
import { WritableStreamToArray } from './stream-to-array';

const mockedFinder = jest.createMockFromModule<AddressFinder>('../../AddressFinder');
mockedFinder.find.mockImplementation((_params: FindParameters) => {
  return Promise.resolve({
    lg_code: '911029',
    lat: 43,
    lon: 141,
    originalName: '',
    town_id: '0002006',
    koaza: '',
    name: '2-31'
  });
})


describe('step3b-transform', () => {
  
  it('複数の都道府県名にマッチする場合は、町名まで正規化して都道府県名を判別する', async () => {
    // 越後県越後市 と 陸奥県越後市 にマッチする
    const dummyData = Query.create(`越後市どこか`);
    const dummyCallback = jest.fn();
    const expectMatchedPatterns: Step3aMatchedPatternType[] = [
      {
        prefecture: '越後県' as PrefectureName,
        city: '越後市',
        input: '槙山村'
      },
      {
        prefecture: '陸奥県' as PrefectureName,
        city: '越後市',
        input: '川袋村'
      }
    ];

    // jest.mock() で AddressFinder クラスをモック化してある
    const target = new NormalizeStep3b(mockedFinder);
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

});
