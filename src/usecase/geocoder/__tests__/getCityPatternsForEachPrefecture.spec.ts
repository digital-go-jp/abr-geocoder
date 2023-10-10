import { describe, it } from '@jest/globals';
import { InterpolatePattern, PrefectureName } from '../../../domain';
import { getCityPatternsForEachPrefecture } from '../getCityPatternsForEachPrefecture';
jest.mock('../getCityRegexPatterns', () => ({
  getCityRegexPatterns: jest.fn()
    .mockReturnValueOnce([
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
    ])
    .mockReturnValueOnce([
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
    ])
}));

describe('getCityPatternsForEachPrefecture', () => {
  it('should return prefectures as Prefecture[]', async () => {
    const prefectures = [
      {
        name: PrefectureName.OKINAWA,
        cities: [
          {
            name: '八重山郡竹富町',
            lg_code: '473812',
          },
          {
            name: '八重山郡与那国町',
            lg_code: '473821',
          }
        ],
      },
      {
        name: PrefectureName.HOKKAIDO,
        cities: [
          {
            name: '札幌市',
            lg_code: '011002',
          },
          {
            name: '札幌市中央区',
            lg_code: '011011',
          },
        ],
      }
    ];
    const expectResult = new Map<PrefectureName, InterpolatePattern[]>([
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

    const results = getCityPatternsForEachPrefecture(prefectures);
    expect(results).toEqual(expectResult);
  });
});