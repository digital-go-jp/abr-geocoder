import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { default as BetterSqlite3, default as Database } from 'better-sqlite3';
import { AddressFinderForStep5, TownRow } from '../AddressFinderForStep5';
import { PrefectureName } from '../types';

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
        all: (params: { prefecture: PrefectureName; cityName: string }) => {
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
describe('AddressFinderForStep5', () => {
  const mockedDB = new Database('<no sql file>');

  const instance = new AddressFinderForStep5({
    db: mockedDB,
    wildcardHelper,
  });

  beforeEach(() => {
    MockedDB.mockClear();
  });

  it('特定できるはずのケース', async () => {
    const result = await instance.find({
      address: '本宿町2丁目22番地の22',
      prefecture: PrefectureName.TOKYO,
      cityName: '府中市',
    });
    expect(result).toEqual({
      lg_code: '132063',
      town_id: '0001002',
      name: '本宿町2丁目',
      koaza: '',
      lat: 35.672654,
      lon: 139.46089,
      originalName: '',
      tempAddress: '22番地の22',
    });
  });

  it('京都の住所ケース', async () => {
    const result = await instance.find({
      address: '中京区柳馬場通夷川上ル五町目242',
      prefecture: PrefectureName.KYOTO,
      cityName: '京都市',
    });
    expect(result).toEqual({
      lg_code: '261041',
      lat: 35.015582,
      lon: 135.763968,
      originalName: '',
      town_id: '0000005',
      koaza: '',
      name: '中京区柳馬場通夷川上ル五町目',
      tempAddress: '242',
    });
  });

  it('見つからないケース', async () => {
    const result = await instance.find({
      address: '御幸町16-1',
      prefecture: PrefectureName.SHIZUOKA,
      cityName: '沼津市',
    });

    expect(result).toEqual(null);
  });

  it('「町」を含む地名', async () => {
    const result = await instance.find({
      address: '森野2-2-22',
      prefecture: PrefectureName.TOKYO,
      cityName: '町田市',
    });

    expect(result).toEqual({
      lg_code: '132098',
      town_id: '0006002',
      name: '森野2-',
      koaza: '',
      lat: 35.548247,
      lon: 139.440264,
      originalName: '',
      tempAddress: '2-22',
    });
  });
});
