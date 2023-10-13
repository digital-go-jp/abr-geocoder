import { describe, expect, it, jest } from '@jest/globals';
import Stream from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { AddressFinderForStep3and5 } from '../../../usecase/geocoder/AddressFinderForStep3and5';
import { Query, FromStep3Type, PrefectureName } from '../../../domain';
import { GeocodingStep3B } from '../step3b-transform';
import { WritableStreamToArray } from './stream-to-array';
import { MatchLevel } from '../../../domain/matchLevel.enum';
import Database from 'better-sqlite3';

jest.mock<AddressFinderForStep3and5>('../../../usecase/geocoder/AddressFinderForStep3and5');
jest.mock('better-sqlite3');

describe('step3b-transform', () => {
  it('複数の都道府県名にマッチする場合は、町名まで正規化して都道府県名を判別する', async () => {
    // 東京都府中市と にマッチする
    const dummyCallback = jest.fn();

    const db = new Database('dummy');
    const wildcardHelper = (address: string) => address;

    const finder = new AddressFinderForStep3and5({
      db,
      wildcardHelper,
    });
    const target = new GeocodingStep3B(finder);
    const outputWrite = new WritableStreamToArray<Query>();
    const matchedPatterns = [
      {
        prefecture: PrefectureName.HIROSHIMA,
        city: '府中市',
        tempAddress: '宮西町2丁目24番地',
      },
      {
        prefecture: PrefectureName.TOKYO,
        city: '府中市',
        tempAddress: '宮西町2丁目24番地',
      },
    ];

    const fromStep3: FromStep3Type = {
      query: Query.create('府中市宮西町2丁目24番地'),
      callback: dummyCallback,
    };
    await pipeline(
      Stream.Readable.from(
        [
          {
            fromStep3,
            matchedPatterns,
          },
        ],
        {
          objectMode: true,
        }
      ),
      target,
      outputWrite
    );

    // step3a で広島県府中市と東京都府中市の2つのパターンが検出されたとする
    // でも MockedAddressFinder が東京都府中市のデータしか返さないので、
    // 東京都府中市だけに特定されるはず
    const actualValues = outputWrite.toArray();
    expect(actualValues.length).toBe(1);
    expect(actualValues[0]).toEqual({
      query: Query.create('府中市宮西町2丁目24番地').copy({
        prefecture: PrefectureName.TOKYO,
        city: '府中市',
        tempAddress: '宮西町2丁目24番地',
        match_level: MatchLevel.ADMINISTRATIVE_AREA,
      }),
      callback: dummyCallback,
    });
  });
});
