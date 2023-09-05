import { describe, expect, it, jest } from '@jest/globals';
import Stream from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  AddressFinderForStep5,
  FindParameters,
} from '../../AddressFinderForStep5';
import { Query } from '../../query.class';
import { FromStep3Type, PrefectureName } from '../../types';
import { NormalizeStep3b } from '../step3b-transform';
import { WritableStreamToArray } from './stream-to-array';

jest.mock<AddressFinderForStep5>('../../AddressFinder');

const MockedAddressFinder = AddressFinderForStep5 as jest.Mock;
MockedAddressFinder.mockImplementation(() => {
  return {
    find: (params: FindParameters) => {
      switch (params.prefecture) {
        case PrefectureName.TOKYO:
          return Promise.resolve({
            lg_code: '132063',
            town_id: '0001002',
            name: '本宿町2丁目',
            koaza: '',
            lat: 35.672654,
            lon: 139.46089,
            originalName: '',
            tempAddress: '22番地の22',
          });
        case PrefectureName.HIROSHIMA:
          return Promise.resolve(null);

        default:
          throw new Error(
            `Unexpected prefecture was given: ${params.prefecture}`
          );
      }
    },
  };
});

describe('step3b-transform', () => {
  it('複数の都道府県名にマッチする場合は、町名まで正規化して都道府県名を判別する', async () => {
    // 東京都府中市と にマッチする
    const dummyCallback = jest.fn();

    // jest.mock() で AddressFinder クラスをモック化してある
    const finder = new MockedAddressFinder() as AddressFinderForStep5;
    const target = new NormalizeStep3b(finder);
    const outputWrite = new WritableStreamToArray<Query>();
    const matchedPatterns = [
      {
        prefecture: PrefectureName.HIROSHIMA,
        city: '府中市',
        input: '宮西町2丁目24番地',
      },
      {
        prefecture: PrefectureName.TOKYO,
        city: '府中市',
        input: '宮西町2丁目24番地',
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

    const actualValues = outputWrite.toArray();
    expect(actualValues.length).toBe(1);
    expect(actualValues[0]).toEqual({
      query: Query.create('府中市宮西町2丁目24番地').copy({
        prefecture: PrefectureName.TOKYO,
        city: '府中市',
      }),
      callback: dummyCallback,
    });
  });
});
