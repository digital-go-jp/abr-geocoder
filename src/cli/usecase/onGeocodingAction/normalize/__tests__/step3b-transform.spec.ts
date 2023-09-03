import {beforeAll, describe, expect, it, jest, xit} from '@jest/globals';
import Stream from "node:stream";
import { Query } from "../../query.class";
import { FromStep3Type, FromStep3aType, ITown, InterpolatePattern, PrefectureName, Step3aMatchedPatternType, getNormalizedCityParams } from "../../types";
import { NormalizeStep3b } from '../step3b-transform';
import { WritableStreamToArray } from './stream-to-array';
import { pipeline } from 'node:stream/promises';
import { dummyPrefectures } from './dummyPrefectures';
import Database from 'better-sqlite3';
import { AddressFinder, FindParameters } from '../../AddressFinder';

jest.mock('better-sqlite3');
jest.mock('../../AddressFinder');
const AddressFinderMock = AddressFinder as jest.Mock;

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

    // jest.mock() で Database クラスをモック化してある
    const mockedDB = new Database(':memory:');
    const wildcardHelper = (address: string) => {
      return address;
    };
    AddressFinderMock.mockImplementation(() => {
      return {
        find: (params: FindParameters): Promise<ITown | null> => {
          return Promise.resolve({
            lg_code: '002-1',
            lat: 0.0,
            lon: 0.0,
            originalName: '越後市',
            town_id: '000',
            koaza: 'something',
            name: 'somewhere'
          })
        }
      }
    })

    // jest.mock() で AddressFinder クラスをモック化してある
    const addressFinder = new AddressFinderMock({
      db: mockedDB,
      wildcardHelper,
    });
    
    const target = new NormalizeStep3b(addressFinder as AddressFinder);
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
