import { beforeEach, describe, expect, it } from '@jest/globals';
import Stream from "node:stream";
import { DASH_ALT } from "../../../../domain";
import { Query } from "../../query.class";
import { InterpolatePattern, PrefectureName } from "../../types";
import { NormalizeStep2 } from '../step2-transform';
import { WritableStreamToArray } from './stream-to-array';

describe('step2transform', () => {
  const testCases: { input: Query, expect: Query }[] = [
    {
      // 千葉県千葉市中央区祐光1-25-3 で、千葉県を省略したケース
      input: Query.create(`千葉市中央区祐光1${DASH_ALT}25${DASH_ALT}3`),

      expect: Query.create(`千葉市中央区祐光1${DASH_ALT}25${DASH_ALT}3`).copy({
        prefectureName: '千葉県' as PrefectureName,
        tempAddress: `中央区祐光1${DASH_ALT}25${DASH_ALT}3`,
        city: '千葉市',
      })
    },

    {
      // 青森県青森市油川字船岡36 で、青森県を省略したケース
      input: Query.create(`青森市油川字船岡36`),

      expect: Query.create(`青森市油川字船岡36`).copy({
        prefectureName: '青森県' as PrefectureName,
        tempAddress: `油川字船岡36`,
        city: '青森市',
      })
    }
  ];
  const sameNamedPrefPatterns: InterpolatePattern[] = [
    {
      address: '千葉県千葉市',
      cityName: '千葉市',
      regExpPattern: '^千葉市',
      prefectureName: '千葉県' as PrefectureName,
    },
    {
      address: '青森県青森市',
      cityName: '青森市',
      regExpPattern: '^青森市',
      prefectureName: '青森県' as PrefectureName,
    }
  ];
  const target = new NormalizeStep2(sameNamedPrefPatterns);
  const outputWrite = new WritableStreamToArray<Query>();

  beforeEach(() => {
    outputWrite.reset();
  });
  
  it('都道府県が省略されていて、', async () => {
    const inputs = testCases.map(x => x.input);
    const source = Stream.Readable.from(inputs, {
      objectMode: true,
    });

    await Stream.promises.pipeline(
      source,
      target,
      outputWrite,
    );
    
    const actualValues = outputWrite.toArray();
    expect(actualValues.length).toBe(testCases.length);
    testCases.forEach((testCaseQuery, i) => {
      expect(actualValues[i]).toEqual(testCaseQuery.expect);
    })

  });
});
