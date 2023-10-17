/*!
 * MIT License
 *
 * Copyright (c) 2023 デジタル庁
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
jest.mock('@domain/geocode/get-city-patterns-for-each-prefecture');
jest.mock('@domain/geocode/get-same-named-prefecture-patterns');
jest.mock('@domain/geocode/get-prefecture-regex-patterns');
jest.mock('@domain/geocode/get-prefectures-from-db');
jest.mock('@settings/patch-patterns');
jest.mock('node:stream');
jest.mock<BetterSqlite3.Database>('better-sqlite3');
jest.mock('../step1-transform');
jest.mock('../step2-transform');
jest.mock('../step3-transform');
jest.mock('../step3a-transform');
jest.mock('../step3b-transform');
jest.mock('../step3final-transform');
jest.mock('../step4-transform');
jest.mock('../step5-transform');
jest.mock('../step6-transform');
jest.mock('../step7-transform');
jest.mock('../step8-transform');
jest.mock('../step8-transform');
jest.dontMock('../stream-geocoder');

import { getCityPatternsForEachPrefecture as getCityP } from '@domain/geocode/get-city-patterns-for-each-prefecture';
import { getPrefectureRegexPatterns as getPreRegP } from '@domain/geocode/get-prefecture-regex-patterns';
import { getPrefecturesFromDB as getPrefs } from '@domain/geocode/get-prefectures-from-db';
import { getSameNamedPrefecturePatterns as getSamePrefs } from '@domain/geocode/get-same-named-prefecture-patterns';
import { default as MockedBetterSqlite3 } from '@mock/better-sqlite3';
import { default as BetterSqlite3 } from 'better-sqlite3';
import { Readable } from 'node:stream';import * as PATCHES from '@settings/patch-patterns';
import { StreamGeocoder } from '../stream-geocoder';

// getPrefecturesFromDB
const mockedGetPrefs = getPrefs as jest.Mocked<typeof getPrefs>;
mockedGetPrefs.mockResolvedValue([]);

// getPrefectureRegexPatterns
const mockedGetPreRegP = getPreRegP as jest.Mocked<typeof getPreRegP>;
mockedGetPreRegP.mockReturnValue([]);

// getSameNamedPrefecturePatterns
const mockedGetSamePrefs = getSamePrefs as jest.Mocked<typeof getSamePrefs>;
mockedGetSamePrefs.mockReturnValue([]);

// getCityPatternsForEachPrefecture
const mockedGetCityP = getCityP as jest.Mocked<typeof getCityP>;
mockedGetCityP.mockReturnValue(new Map());

const step8pipe = jest.fn().mockImplementation(() => {
  return {
    pipe: jest.fn(),
  };
});
const step7pipe = jest.fn().mockImplementation(() => {
  return {
    pipe: step8pipe,
  };
});
const step6pipe = jest.fn().mockImplementation(() => {
  return {
    pipe: step7pipe,
  };
});
const step5pipe = jest.fn().mockImplementation(() => {
  return {
    pipe: step6pipe,
  };
});
const step4pipe = jest.fn().mockImplementation(() => {
  return {
    pipe: step5pipe,
  };
});
const step3pipe = jest.fn().mockImplementation(() => {
  return {
    pipe: step4pipe,
  };
});
const step3finalpipe = jest.fn().mockImplementation(() => {
  return {
    pipe: step3pipe,
  };
});

// Readable
const mockedReadable = Readable as unknown as jest.Mock;
mockedReadable.prototype.pipe.mockReturnValue({
  pipe: step3finalpipe
});

const mockedPatches = PATCHES as jest.MockedObject<typeof PATCHES>;
mockedPatches.default = [];


const createDB = () => {
  return new MockedBetterSqlite3('<no sql file>', {
    all: [],
  });
}
describe('StreamGeocoder', () => {

  describe('(internal) wildCardHelper', () => {
    //
    // Do not run these test concurrenctly.
    //
    
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('Fuzzyを指定しない場合、同じ値を返す', async () => {
      const mockedDB = createDB();
      await StreamGeocoder.create(mockedDB);
      expect(mockedGetPreRegP).toHaveBeenCalled();
      const args = mockedGetPreRegP.mock.calls[0];
      const wildcardHelper = args[0].wildcardHelper;
      expect(wildcardHelper('^愛知郡愛荘町')).toEqual('^愛知郡愛荘町');
    });

    it('Fuzzyを指定した場合、正規表現を書き換える', async () => {
      const fuzzy = '●';
      const mockedDB = createDB();
      await StreamGeocoder.create(mockedDB, fuzzy);
      expect(mockedGetPreRegP).toHaveBeenCalled();
      const args = mockedGetPreRegP.mock.calls[0];
      const wildcardHelper = args[0].wildcardHelper;
      expect(wildcardHelper('^愛知郡愛荘町'))
        .toEqual(`^(愛|\\${fuzzy})(知|\\${fuzzy})(郡|\\${fuzzy})(愛|\\${fuzzy})(荘|\\${fuzzy})(町|\\${fuzzy})`);
    });
  })
});
