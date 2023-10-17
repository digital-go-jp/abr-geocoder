import { describe, it } from '@jest/globals';
import { PrefectureName } from '@domain/prefecture-name';
import { Prefecture } from '@domain/prefecture';
import {  getCityRegexPatterns } from '../get-city-regex-patterns';

jest.mock('../to-regex-pattern');

describe('getCityRegexPatterns', () => {
  it('should return InterpolatePattern list', async () => {
    const prefecture = new Prefecture({
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
    });

    const results = getCityRegexPatterns({
      prefecture,
    });

    // 文字数が長い順に並び替えるので、与那国町 -> 竹富町 の順になる
    expect(results).toEqual([
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
    ]);
  });
});
