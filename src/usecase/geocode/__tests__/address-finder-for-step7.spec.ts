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
import { MatchLevel } from '@domain/match-level';
import { PrefectureName } from '@domain/prefecture-name';
import { Query } from '@domain/query';
import { describe, expect, it, jest } from '@jest/globals';
import { DASH, SINGLE_DASH_ALTERNATIVE, SPACE } from '@settings/constant-values';
import { default as BetterSqlite3, default as Database } from 'better-sqlite3';
import dummyBlockList from './dummyBlockList.json';
import dummyRsdtList2 from './dummyRsdtList2.json';
import dummySmallBlockListIwate from './dummySmallBlockListIwate.json';
import dummySmallBlockListMiyagi from './dummySmallBlockListMiyagi.json';
import { AddressFinderForStep7 } from '../address-finder-for-step7';

jest.mock<BetterSqlite3.Database>('better-sqlite3');

const MockedDB = Database as unknown as jest.Mock;

MockedDB.mockImplementation(() => {
  return {
    prepare: (sql: string) => {
      return {
        all: (params: {
          prefecture?: PrefectureName;
          city?: string;
          town?: string;
        }) => {
          // statementに合わせてデータを返す
          if (sql.includes('/* unit test: getBlockListStatement */')) {
            switch(params.prefecture) {
              case PrefectureName.TOKYO:
                return dummyBlockList;
              
              default:
                return [];
            }
          }
          if (sql.includes('/* unit test: getRsdtListStatement2 */')) {
            return dummyRsdtList2;
          }
          if (sql.includes('/* unit test: getSmallBlockListStatement */')) {

            switch (params.prefecture) {
              case PrefectureName.MIYAGI:
                return dummySmallBlockListMiyagi;

              case PrefectureName.IWATE:
                return dummySmallBlockListIwate;
              
              case PrefectureName.FUKUSHIMA:
                return [
                  {
                    "lg_code": "072044",
                    "town_id": "0113116",
                    "pref": "福島県",
                    "city": "いわき市",
                    "town": "山玉町",
                    "koaza_name": "脇川",
                    "lat": 36.901176,
                    "lon": 140.725118
                  }
                ];

              default:
                return [];
            }
          }
          throw new Error('Unexpected sql was given');
        }
      }
    },
  };
});

// TODO: カバレッジ100%になるテストケースを考える
describe('AddressFinderForStep7', () => {
  const mockedDB = new Database('<no sql file>');
  const addressFinder = new AddressFinderForStep7(mockedDB);
  
  describe('find', () => {
    it.concurrent('住居表示の街区までマッチするケース1', async () => {
      const inputAddress = `東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階`;
      const query = Query.create(inputAddress).copy({
        prefecture: PrefectureName.TOKYO,
        city: '千代田区',
        town: '紀尾井町',
        tempAddress: `1${DASH}3 東京ガーデンテラス紀尾井町 19階、20階`,
      });

      const result = await addressFinder.find(query);
      expect(result).toEqual(Query.create(inputAddress).copy({
        prefecture: PrefectureName.TOKYO,
        city: '千代田区',
        town: '紀尾井町',
        tempAddress: `${DASH}3 東京ガーデンテラス紀尾井町 19階、20階`,
        lg_code: '131016',
        town_id: '0056000',
        block_id: '001',
        block: '1',
        lat: 35.679921,
        lon: 139.737183,
        match_level: MatchLevel.RESIDENTIAL_BLOCK,
      }))
    });

    it.concurrent('住居表示の街区までマッチするケース2', async () => {
      const inputAddress = `東京都千代田区紀尾井町1`;
      const query = Query.create(inputAddress).copy({
        prefecture: PrefectureName.TOKYO,
        city: '千代田区',
        town: '紀尾井町',
        tempAddress: '1',
      });

      const result = await addressFinder.find(query);
      expect(result).toEqual(Query.create(inputAddress).copy({
        prefecture: PrefectureName.TOKYO,
        city: '千代田区',
        town: '紀尾井町',
        lg_code: '131016',
        town_id: '0056000',
        block_id: '001',
        block: '1',
        lat: 35.679921,
        lon: 139.737183,
        tempAddress: '',
        match_level: MatchLevel.RESIDENTIAL_BLOCK,
      }))
    });

    it.concurrent('マッチしない場合は、Queryを変更しない', async () => {
      const inputAddress = `広島市佐伯区海老園二丁目5番28号`;
      const query = Query.create(inputAddress).copy({
        prefecture: PrefectureName.HIROSHIMA,
        city: '広島市',
        town: '佐伯区海老園',
        tempAddress: '二丁目5番28号',
        match_level: MatchLevel.TOWN_LOCAL,
      });

      const result = await addressFinder.find(query);
      expect(result).toEqual(query);
    })

    it.concurrent('住居表示の街区を含まないケース', async () => {
      const inputAddress = `広島市佐伯区海老園`;
      const query = Query.create(inputAddress).copy({
        prefecture: PrefectureName.HIROSHIMA,
        city: '広島市',
        town: '佐伯区海老園',
        tempAddress: '',
        match_level: MatchLevel.TOWN_LOCAL,
      });

      const result = await addressFinder.find(query);
      expect(result).toEqual(query);
    })
  });

  describe('findDetail', () => {
    it.concurrent('住居表示の街区符号・住居番号までの判別ができるケース', async () => {
      const inputAddress = `東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階`;
      const query = Query.create(inputAddress).copy({
        prefecture: PrefectureName.TOKYO,
        city: '千代田区',
        town: '紀尾井町',
        tempAddress: `${DASH}3 東京ガーデンテラス紀尾井町 19階、20階`,
        lg_code: '131016',
        town_id: '0056000',
        block_id: '001',
        block: '1',
        lat: 35.679921,
        lon: 139.737183,
        match_level: MatchLevel.RESIDENTIAL_BLOCK,
      });

      const result = await addressFinder.findDetail(query);
      expect(result).toEqual(Query.create(inputAddress).copy({
        prefecture: PrefectureName.TOKYO,
        city: '千代田区',
        town: '紀尾井町',
        tempAddress: ' 東京ガーデンテラス紀尾井町 19階、20階',
        lg_code: '131016',
        town_id: '0056000',
        block_id: '001',
        block: '1',
        addr1: '3',
        addr1_id: '003',
        addr2: '',
        addr2_id: '',
        lat: 35.679107172,
        lon: 139.736394597,
        match_level: MatchLevel.RESIDENTIAL_DETAIL,
      }))
    });
  });

  describe('findForKoaza', () => {
      

    it.concurrent('小字が1件しかマッチしないケース', async () => {
      const inputAddress = `いわき市山玉町脇川2${SPACE}いわき市役所${SPACE}水道局${SPACE}山玉浄水場`;
      const query = Query.create(inputAddress).copy({
        prefecture: PrefectureName.FUKUSHIMA,
        city: 'いわき市',
        town: '山玉町',
        tempAddress: `脇川2${SPACE}いわき市役所${SPACE}水道局${SPACE}山玉浄水場`,
        match_level: MatchLevel.TOWN_LOCAL,
      });

      const result = await addressFinder.findForKoaza(query);
      expect(result).toEqual(Query.create(inputAddress).copy({
        prefecture: PrefectureName.FUKUSHIMA,
        city: 'いわき市',
        town: '山玉町脇川',
        block: '2',
        tempAddress: `いわき市役所${SPACE}水道局${SPACE}山玉浄水場`,
        lat: 36.901176,
        lg_code: '072044',
        lon: 140.725118,
        town_id: '0113116',
        match_level: MatchLevel.TOWN_LOCAL,
      }));
    })

    it.concurrent('小字が複数マッチするケース', async () => {
      const inputAddress = `岩手県盛岡市飯岡新田４地割１００１${SPACE}河南自治公民館`;
      const query = Query.create(inputAddress).copy({
        prefecture: PrefectureName.IWATE,
        city: '盛岡市',
        town: '飯岡新田',
        tempAddress: `4地割1001${SPACE}河南自治公民館`,
        match_level: MatchLevel.TOWN_LOCAL,
      });

      const result = await addressFinder.findForKoaza(query);
      expect(result).toEqual(Query.create(inputAddress).copy({
        prefecture: PrefectureName.IWATE,
        city: '盛岡市',
        town: '飯岡新田4地割',
        block: '1001',
        tempAddress: `河南自治公民館`,
        town_id: '0007105',
        lg_code: '032018',
        match_level: MatchLevel.TOWN_LOCAL,
      }));
    })
  });
});
