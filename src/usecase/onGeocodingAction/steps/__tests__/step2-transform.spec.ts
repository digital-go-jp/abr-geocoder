import { describe, expect, it } from '@jest/globals';
import Stream from "node:stream";
import { DASH_ALT } from '../../../../domain/constantValues';
import { Query } from "../../query.class";
import { InterpolatePattern, PrefectureName } from "../../types";
import { NormalizeStep2 } from '../step2-transform';
import { WritableStreamToArray } from './stream-to-array';

const sameNamedPrefPatterns: InterpolatePattern[] = [
  {
    address: `${PrefectureName.HIROSHIMA}広島市`,
    regExpPattern: '^広島市',
    prefectureName: PrefectureName.HIROSHIMA,
    cityName: '広島市'
  },
  {
    address: `${PrefectureName.HIROSHIMA}広島市佐伯区`,
    regExpPattern: '^広島市佐伯区',
    prefectureName: PrefectureName.HIROSHIMA,
    cityName: '広島市佐伯区'
  },
  {
    address: `${PrefectureName.KYOTO}京都市`,
    regExpPattern: '^京都市',
    prefectureName: PrefectureName.KYOTO,
    cityName: '京都市'
  },
  {
    address: `${PrefectureName.KYOTO}京都市北区`,
    regExpPattern: '^京都市北区',
    prefectureName: PrefectureName.KYOTO,
    cityName: '京都市北区'
  },
  {
    address: `${PrefectureName.KYOTO}京都市上京区`,
    regExpPattern: '^京都市上京区',
    prefectureName: PrefectureName.KYOTO,
    cityName: '京都市上京区'
  },
  {
    address: `${PrefectureName.NAGASAKI}長崎市`,
    regExpPattern: '^長崎市',
    prefectureName: PrefectureName.NAGASAKI,
    cityName: '長崎市'
  },
  {
    address: `${PrefectureName.KAGOSHIMA}県鹿児島市`,
    regExpPattern: '^鹿児島市',
    prefectureName: PrefectureName.KAGOSHIMA,
    cityName: '鹿児島市'
  },
  {
    address: `${PrefectureName.KAGOSHIMA}鹿児島郡三島村`,
    regExpPattern: '^鹿児島郡三島村',
    prefectureName: PrefectureName.KAGOSHIMA,
    cityName: '鹿児島郡三島村'
  },
  {
    address: `${PrefectureName.KAGOSHIMA}鹿児島郡十島村`,
    regExpPattern: '^鹿児島郡十島村',
    prefectureName: PrefectureName.KAGOSHIMA,
    cityName: '鹿児島郡十島村'
  },
  {
    address: `${PrefectureName.FUKUSHIMA}石川郡石川町`,
    regExpPattern: '^石川郡石川町',
    prefectureName: PrefectureName.FUKUSHIMA,
    cityName: '石川郡石川町'
  },
  {
    address: `${PrefectureName.FUKUSHIMA}石川郡玉川村`,
    regExpPattern: '^石川郡玉川村',
    prefectureName: PrefectureName.FUKUSHIMA,
    cityName: '石川郡玉川村'
  },
  {
    address: `${PrefectureName.FUKUSHIMA}石川郡平田村`,
    regExpPattern: '^石川郡平田村',
    prefectureName: PrefectureName.FUKUSHIMA,
    cityName: '石川郡平田村'
  },
  {
    address: `${PrefectureName.FUKUSHIMA}石川郡浅川町`,
    regExpPattern: '^石川郡浅川町',
    prefectureName: PrefectureName.FUKUSHIMA,
    cityName: '石川郡浅川町'
  },
  {
    address: `${PrefectureName.FUKUSHIMA}石川郡古殿町`,
    regExpPattern: '^石川郡古殿町',
    prefectureName: PrefectureName.FUKUSHIMA,
    cityName: '石川郡古殿町'
  }
];

const prefPatterns: InterpolatePattern[] = [
  {
    "address": "東京都",
    "prefectureName": PrefectureName.TOKYO,
    "regExpPattern": "^東京都?",
  },
  {
    "address": "北海道",
    "prefectureName": PrefectureName.HOKKAIDO,
    "regExpPattern": "^北海道?",
  },
  {
    "address": "広島県",
    "prefectureName": PrefectureName.HIROSHIMA,
    "regExpPattern": "^広島県?",
  },
  {
    "address": "京都府",
    "prefectureName": PrefectureName.KYOTO,
    "regExpPattern": "^京都府?",
  },
];

/**
 * step2は都道府県名と同一名称の市町村名に対しての処理のみ
 */
describe('step2transform', () => {
  
  const doProcess = async (input: Query, expectValues: Query[]) => {
    const source = Stream.Readable.from([input], {
      objectMode: true,
    });

    const target = new NormalizeStep2({
      prefPatterns,
      sameNamedPrefPatterns,
    });
    const outputWrite = new WritableStreamToArray<Query>();
    await Stream.promises.pipeline(
      source,
      target,
      outputWrite,
    );

    const actualValues = outputWrite.toArray();

    expect(actualValues.length).toBe(expectValues.length);
    expect(actualValues).toEqual(expectValues);
  };
  
  it('"長崎" 県 "長崎" 市と同一名称を含むケース', async () => {
    const input = Query.create(`長崎市魚の町4${DASH_ALT}1`);
    const expectValues = [
        Query.create(`長崎市魚の町4${DASH_ALT}1`).copy({
        prefectureName: PrefectureName.NAGASAKI,
        tempAddress: `魚の町4${DASH_ALT}1`,
        city: '長崎市',
      }),
    ];
    await doProcess(input, expectValues);
  });

  it('他都道府県名を含む市町村名のケース', async () => {
    const input = Query.create(`石川郡平田村大字永田字切田116番地`);
    const expectValues = [
      Query.create(`石川郡平田村大字永田字切田116番地`).copy({
        prefectureName: PrefectureName.FUKUSHIMA,
        tempAddress: `大字永田字切田116番地`,
        city: '石川郡平田村',
      }),
    ];
    await doProcess(input, expectValues);
  });

  it('step2ではマッチしないケース', async () => {
    const input = Query.create(`東彼杵郡東彼杵町蔵本郷1850番地6`);
    const expectValues = [
      input,
    ];
    await doProcess(input, expectValues);
  });

  it('都道府県名を含むケース', async () => {
    const input = Query.create(`東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階`);
    const expectValues = [
      Query.create(`東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階`).copy({
        prefectureName: PrefectureName.TOKYO,
        tempAddress: `千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階`,
      }),
    ];
    await doProcess(input, expectValues);
  });
});
