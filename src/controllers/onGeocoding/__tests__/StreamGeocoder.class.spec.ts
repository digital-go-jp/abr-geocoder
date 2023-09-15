import { jest, describe, expect, it, beforeEach } from '@jest/globals';
jest.mock('../../../domain/jisKanji');
// jest.mock('../../../domain/RegExpEx');
// jest.mock('../../../domain');
jest.mock('../../../settings/patchPatterns');
jest.mock('node:stream');
jest.mock('../../../usecase');
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


import { JisKanji } from '../../../domain/jisKanji';
const mockedJisKanji = JisKanji as jest.Mocked<typeof JisKanji>;
mockedJisKanji.replaceAll.mockReturnValue('');

import { StreamGeocoder } from '../StreamGeocoder.class';
import { default as BetterSqlite3, default as Database } from 'better-sqlite3';
import { PrefectureName } from '../../../domain/types/';
import { GeocodingStep1 as Step1 } from '../step1-transform';
import { GeocodingStep2 as Step2 } from '../step2-transform';
import { GeocodingStep3 as Step3 } from '../step3-transform';
import { GeocodingStep3A as Step3A } from '../step3a-transform';
import { GeocodingStep3B as Step3B } from '../step3b-transform';
import { GeocodingStep3Final as Step3Final } from '../step3final-transform';
import { GeocodingStep4 as Step4 } from '../step4-transform';
import { GeocodingStep5 as Step5 } from '../step5-transform';
import { GeocodingStep6 as Step6 } from '../step6-transform';
import { GeocodingStep7 as Step7 } from '../step7-transform';
import { GeocodingStep8 as Step8 } from '../step8-transform';
import { Readable, Writable } from 'node:stream';
import * as PATCHES from '../../../settings/patchPatterns';
import {
  AddressFinderForStep3and5 as Addr3and5,
  AddressFinderForStep7 as Addr7,
  getCityPatternsForEachPrefecture as getCityP,
  getPrefectureRegexPatterns as getPreRegP,
  getPrefecturesFromDB as getPrefs,
  getSameNamedPrefecturePatterns as getSamePrefs,
} from '../../../usecase';

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

// BetterSqlite3.Database
const MockedDB = Database as unknown as jest.Mock;
MockedDB.mockImplementation(() => {
  return {
    prepare: (sql: string) => {
      return {
        all: (params: { prefecture: PrefectureName; city: string }) => {
          return [];
        },
      };
    },
  };
});
describe('StreamGeocoder', () => {

  const mockedDB = new Database('<no sql file>');
  beforeEach(() => {
    MockedDB.mockReset();
    mockedGetPrefs.mockReset();
    mockedGetPreRegP.mockReset();
  })
  describe('(internal) wildCardHelper', () => {
    it('Fuzzyを指定しない場合、同じ値を返す', async () => {
      await StreamGeocoder.create(mockedDB);
      expect(mockedGetPreRegP).toHaveBeenCalled();
      const args = mockedGetPreRegP.mock.calls[0];
      const wildcardHelper = args[0].wildcardHelper;
      expect(wildcardHelper('^愛知郡愛荘町')).toEqual('^愛知郡愛荘町');
    });

    it('Fuzzyを指定した場合、正規表現を書き換える', async () => {
      const fuzzy = '●';
      await StreamGeocoder.create(mockedDB, fuzzy);
      expect(mockedGetPreRegP).toHaveBeenCalled();
      const args = mockedGetPreRegP.mock.calls[0];
      const wildcardHelper = args[0].wildcardHelper;
      expect(wildcardHelper('^愛知郡愛荘町'))
        .toEqual(`^(愛|${fuzzy})(知|${fuzzy})(郡|${fuzzy})(愛|${fuzzy})(荘|${fuzzy})(町|${fuzzy})`);
    });
  })
});
