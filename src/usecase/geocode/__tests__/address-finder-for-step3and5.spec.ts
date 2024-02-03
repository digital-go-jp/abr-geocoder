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
import { PrefectureName } from '@domain/prefecture-name';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DASH } from '@settings/constant-values';
import { default as BetterSqlite3, default as Database } from 'better-sqlite3';
import { AddressFinderForStep3and5, TownRow } from '../address-finder-for-step3and5';

jest.mock<BetterSqlite3.Database>('better-sqlite3');

const MockedDB = Database as unknown as jest.Mock;
const tokyoTowns: TownRow[] = [
  {
    lg_code: '132063',
    town_id: '0001001',
    name: '本宿町一丁目',
    koaza: '',
    lat: 35.670488,
    lon: 139.45922,
  },
  {
    lg_code: '132063',
    town_id: '0001002',
    name: '本宿町二丁目',
    koaza: '',
    lat: 35.672654,
    lon: 139.46089,
  },
  {
    lg_code: '132063',
    town_id: '0001003',
    name: '本宿町三丁目',
    koaza: '',
    lat: 35.675603,
    lon: 139.463026,
  },
  {
    lg_code: '132098',
    town_id: '0006001',
    name: '森野一丁目',
    koaza: '',
    lat: 35.545071,
    lon: 139.442744,
  },
  {
    lg_code: '132098',
    town_id: '0006002',
    name: '森野二丁目',
    koaza: '',
    lat: 35.548247,
    lon: 139.440264,
  },
  {
    lg_code: '132098',
    town_id: '0006003',
    name: '森野三丁目',
    koaza: '',
    lat: 35.552803,
    lon: 139.436791,
  },
  {
    lg_code: '132098',
    town_id: '0006004',
    name: '森野四丁目',
    koaza: '',
    lat: 35.554528,
    lon: 139.43203,
  },
  {
    lg_code: '132098',
    town_id: '0006005',
    name: '森野五丁目',
    koaza: '',
    lat: 35.549288,
    lon: 139.434905,
  },
  {
    lg_code: '132098',
    town_id: '0006006',
    name: '森野六丁目',
    koaza: '',
    lat: 35.552002,
    lon: 139.43072,
  },
];

const kyotoTowns: TownRow[] = [
  {
    lg_code: '261041',
    town_id: '0000004',
    name: '四丁目',
    koaza: '',
    lat: 35.016866,
    lon: 135.764047,
  },
  {
    lg_code: '261041',
    town_id: '0000005',
    name: '五丁目',
    koaza: '',
    lat: 35.015582,
    lon: 135.763968,
  },
  {
    lg_code: '261041',
    town_id: '0000006',
    name: '六丁目',
    koaza: '',
    lat: 35.014288,
    lon: 135.763985,
  },
];

MockedDB.mockImplementation(() => {
  return {
    prepare: (sql: string) => {
      return {
        all: (params: { prefecture: PrefectureName; city: string }) => {
          switch (params.prefecture) {
            case PrefectureName.TOKYO:
              return tokyoTowns;

            case PrefectureName.KYOTO:
              return kyotoTowns;

            case PrefectureName.SHIZUOKA:
              return [];

            default:
              throw new Error(`Unexpected prefecture : ${params.prefecture}`);
          }
        },
      };
    },
  };
});

const wildcardHelper = (address: string) => {
  return address;
};
describe('AddressFinderForStep3and5', () => {
  const mockedDB = new Database('<no sql file>');

  const instance = new AddressFinderForStep3and5({
    db: mockedDB,
    wildcardHelper,
  });

  beforeEach(() => {
    MockedDB.mockClear();
  });

  it.concurrent('特定できるはずのケース', async () => {
    const result = await instance.find({
      address: '本宿町2丁目22番地の22',
      prefecture: PrefectureName.TOKYO,
      city: '府中市',
    });
    expect(result).toEqual({
      lg_code: '132063',
      town_id: '0001002',
      name: '本宿町二丁目',
      koaza: '',
      lat: 35.672654,
      lon: 139.46089,
      originalName: '',
      tempAddress: '22番地の22',
    });
  });

  it.concurrent('京都の住所ケース', async () => {
    const result = await instance.find({
      address: '中京区柳馬場通夷川上ル五町目242',
      prefecture: PrefectureName.KYOTO,
      city: '京都市',
    });
    expect(result).toEqual({
      lg_code: '261041',
      lat: 35.015582,
      lon: 135.763968,
      originalName: '',
      town_id: '0000005',
      koaza: '',
      name: '五丁目',
      tempAddress: '242',
    });
  });

  it.concurrent('見つからないケース', async () => {
    const result = await instance.find({
      address: `御幸町16${DASH}1`,
      prefecture: PrefectureName.SHIZUOKA,
      city: '沼津市',
    });

    expect(result).toEqual(null);
  });

  it.concurrent('「町」を含む地名', async () => {
    const result = await instance.find({
      address: `森野2${DASH}2${DASH}22`,
      prefecture: PrefectureName.TOKYO,
      city: '町田市',
    });

    expect(result).toEqual({
      lg_code: '132098',
      town_id: '0006002',
      name: `森野二丁目`,
      koaza: '',
      lat: 35.548247,
      lon: 139.440264,
      originalName: '',
      tempAddress: `2${DASH}22`,
    });
  });
});
