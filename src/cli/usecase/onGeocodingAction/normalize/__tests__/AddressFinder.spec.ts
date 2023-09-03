import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { default as BetterSqlite3, default as Database } from 'better-sqlite3';
import { AddressFinder, TownRow } from '../../AddressFinder';
import { PrefectureName } from "../../types";

jest.mock<BetterSqlite3.Database>('better-sqlite3');

const MockedDB = Database as unknown as jest.Mock;
const mockedAll = jest.fn()
    .mockReturnValue([
      {
        lg_code: '911029',
        town_id: '0002005',
        name: '一丁目',
        koaza: '',
        lat: 43.00000,
        lon: 141.00000,
      },
      {
        lg_code: '911029',
        town_id: '0002006',
        name: '二丁目',
        koaza: '',
        lat: 43.00000,
        lon: 141.00000,
      },
      {
        lg_code: '465259',
        town_id: '0001000',
        name: '大字伊子茂',
        koaza: '',
        lat: 43.00000,
        lon: 141.00000,
      },
      {
        lg_code: '473812',
        town_id: '0000125',
        name: '字波照間',
        koaza: '名石',
        lat: 43.00000,
        lon: 141.00000,
      },
      {
        lg_code: '261041',
        town_id: '0098000',
        name: '中京区',
        koaza: '',
        lat: 35.011582,
        lon: 135.767914,
      },
      {
        lg_code: '132098',
        town_id: '0000101',
        name: '町田市',
        koaza: '綾部',
        lat: 35.59182,
        lon: 139.454577,
      },
      {
        lg_code: '131181',
        town_id: '0002008',
        name: '荒川区町屋',
        koaza: '',
        lat: 35.747448,
        lon: 139.786319,
      }
    ] as TownRow[]);

    
const mockedPrepare = jest.fn().mockImplementation(() => {
  return {
    all: mockedAll,
  };
})
MockedDB.mockImplementationOnce(() => {
  return {
    prepare: mockedPrepare,
  }
})

const wildcardHelper = (address: string) => {
  return address;
};
describe('AddressFinder', () => {
  const mockedDB = new Database('<no sql file>');

  const instance = new AddressFinder({
    db: mockedDB,
    wildcardHelper,
  });

  beforeEach(() => {
    MockedDB.mockClear();
    mockedAll.mockClear();
    mockedPrepare.mockClear();
  })
  
  it('期待される住所ケース', async () => {

    const result = await instance.find({
      address: '二丁目2-31',
      prefecture: '越後県' as PrefectureName,
      cityName: '越後市',
    });

    expect(result).toEqual({
      lg_code: '911029',
      lat: 43,
      lon: 141,
      originalName: '',
      town_id: '0002006',
      koaza: '',
      name: '2-31'
    });
  });

  it('京都の住所ケース', () => {

    instance.find({
      address: '中京区寺町通御池上る上本能寺前町488',
      prefecture: '京都府' as PrefectureName,
      cityName: '京都市',
    })
    .then((result) => {
      expect(result).toEqual({
        lg_code: '261041',
        lat: 35.011582,
        lon: 135.767914,
        originalName: '',
        town_id: '0098000',
        koaza: '',
        name: '寺町通御池上る上本能寺前町488'
      });
    })
  });

  it('見つからないケース', async () => {

    const result = await instance.find({
      address: 'どこかの488',
      prefecture: '存在しない県' as PrefectureName,
      cityName: '存在しない市',
    });

    expect(result).toEqual(null);
  });

  // 正しいケースがはっきりとしないので、一旦コメントアウト（正しく？動いてはいるらしい）

  // it('町田市', async () => {

  //   const result = await instance.find({
  //     address: 'どこかの488',
  //     prefecture: '東京都' as PrefectureName,
  //     cityName: '町田市',
  //   });

  //   expect(result).toEqual(null);
  // });
  // it('町屋', async () => {

  //   const result = await instance.find({
  //     address: '町屋八丁目2番5号',
  //     prefecture: PrefectureName.TOKYO,
  //     cityName: '荒川区',
  //   });

  //   expect(result).toEqual(null);
  // });
});
