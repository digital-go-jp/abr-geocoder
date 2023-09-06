import { describe, expect, it } from '@jest/globals';
import Stream from 'node:stream';
import { DASH } from '../../../settings/constantValues';
import { InterpolatePattern, PrefectureName, Query } from '../../../domain/';
import { GeocodingStep2 } from '../step2-transform';
import { WritableStreamToArray } from './stream-to-array';
import { MatchLevel } from '../../../domain/matchLevel.enum';

const sameNamedPrefPatterns: InterpolatePattern[] = [
  {
    regExpPattern: '^広島市',
    prefecture: PrefectureName.HIROSHIMA,
    city: '広島市',
  },
  {
    regExpPattern: '^広島市佐伯区',
    prefecture: PrefectureName.HIROSHIMA,
    city: '広島市佐伯区',
  },
  {
    regExpPattern: '^京都市',
    prefecture: PrefectureName.KYOTO,
    city: '京都市',
  },
  {
    regExpPattern: '^京都市北区',
    prefecture: PrefectureName.KYOTO,
    city: '京都市北区',
  },
  {
    regExpPattern: '^京都市上京区',
    prefecture: PrefectureName.KYOTO,
    city: '京都市上京区',
  },
  {
    regExpPattern: '^長崎市',
    prefecture: PrefectureName.NAGASAKI,
    city: '長崎市',
  },
  {
    regExpPattern: '^鹿児島市',
    prefecture: PrefectureName.KAGOSHIMA,
    city: '鹿児島市',
  },
  {
    regExpPattern: '^鹿児島郡三島村',
    prefecture: PrefectureName.KAGOSHIMA,
    city: '鹿児島郡三島村',
  },
  {
    regExpPattern: '^鹿児島郡十島村',
    prefecture: PrefectureName.KAGOSHIMA,
    city: '鹿児島郡十島村',
  },
  {
    regExpPattern: '^石川郡石川町',
    prefecture: PrefectureName.FUKUSHIMA,
    city: '石川郡石川町',
  },
  {
    regExpPattern: '^石川郡玉川村',
    prefecture: PrefectureName.FUKUSHIMA,
    city: '石川郡玉川村',
  },
  {
    regExpPattern: '^石川郡平田村',
    prefecture: PrefectureName.FUKUSHIMA,
    city: '石川郡平田村',
  },
  {
    regExpPattern: '^石川郡浅川町',
    prefecture: PrefectureName.FUKUSHIMA,
    city: '石川郡浅川町',
  },
  {
    regExpPattern: '^石川郡古殿町',
    prefecture: PrefectureName.FUKUSHIMA,
    city: '石川郡古殿町',
  },
];

const prefPatterns: InterpolatePattern[] = [
  {
    prefecture: PrefectureName.TOKYO,
    regExpPattern: '^東京都?',
  },
  {
    prefecture: PrefectureName.HOKKAIDO,
    regExpPattern: '^北海道?',
  },
  {
    prefecture: PrefectureName.HIROSHIMA,
    regExpPattern: '^広島県?',
  },
  {
    prefecture: PrefectureName.KYOTO,
    regExpPattern: '^京都府?',
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

    const target = new GeocodingStep2({
      prefPatterns,
      sameNamedPrefPatterns,
    });
    const outputWrite = new WritableStreamToArray<Query>();
    await Stream.promises.pipeline(source, target, outputWrite);

    const actualValues = outputWrite.toArray();

    expect(actualValues.length).toBe(expectValues.length);
    expect(actualValues).toEqual(expectValues);
  };

  it('"長崎" 県 "長崎" 市と同一名称を含むケース', async () => {
    const input = Query.create(`長崎市魚の町4${DASH}1`);
    const expectValues = [
      Query.create(`長崎市魚の町4${DASH}1`).copy({
        prefecture: PrefectureName.NAGASAKI,
        tempAddress: `魚の町4${DASH}1`,
        city: '長崎市',
        match_level: MatchLevel.ADMINISTRATIVE_AREA,
      }),
    ];
    await doProcess(input, expectValues);
  });

  it('他都道府県名を含む市町村名のケース', async () => {
    const input = Query.create('石川郡平田村大字永田字切田116番地');
    const expectValues = [
      Query.create('石川郡平田村大字永田字切田116番地').copy({
        prefecture: PrefectureName.FUKUSHIMA,
        tempAddress: '大字永田字切田116番地',
        city: '石川郡平田村',
        match_level: MatchLevel.ADMINISTRATIVE_AREA,
      }),
    ];
    await doProcess(input, expectValues);
  });

  it('step2ではマッチしないケース', async () => {
    const input = Query.create('東彼杵郡東彼杵町蔵本郷1850番地6');
    const expectValues = [input];
    await doProcess(input, expectValues);
  });

  it('都道府県名を含むケース', async () => {
    // オリジナルの住所
    const inputAddress = '東京都千代田区紀尾井町1-3 東京ガーデンテラス紀尾井町 19階、20階';

    // Step1で 1-3 の「-(ハイフン)」は DASHに置き換えられている
    const input = Query.create(inputAddress).copy({
      tempAddress: `東京都千代田区紀尾井町1${DASH}3 東京ガーデンテラス紀尾井町 19階、20階`,
    });
    const expectValues = [
      Query.create(inputAddress).copy({
        prefecture: PrefectureName.TOKYO,
        tempAddress: `千代田区紀尾井町1${DASH}3 東京ガーデンテラス紀尾井町 19階、20階`,
        match_level: MatchLevel.PREFECTURE,
      }),
    ];
    await doProcess(input, expectValues);
  });
});
