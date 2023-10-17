import { PrefectureName } from "@domain/prefecture-name";
import { jest } from '@jest/globals';

export const getCityRegexPatterns = jest.fn()
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