import { beforeEach, describe, expect, it } from '@jest/globals';
import Stream from 'node:stream';
import { DASH, SPACE } from '../../../../domain/constantValues';
import { Query } from '../../query.class';
import { NormalizeStep1 } from '../step1-transform';
import { WritableStreamToArray } from './stream-to-array';

describe('step1-transform', () => {
  const target = new NormalizeStep1();
  const outputWrite = new WritableStreamToArray<Query>();

  beforeEach(() => {
    outputWrite.reset();
  });

  it('全角英数字・全角スペースを半角にする', async () => {
    const source = Stream.Readable.from(
      [
        Query.create('1-2-3'),
        Query.create('１−２−３'),
        Query.create('ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ'),
        Query.create('ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ'),
        Query.create('東京都　　　 　渋谷区　３丁目０−０−０'),
      ],
      {
        objectMode: true,
      }
    );

    await Stream.promises.pipeline(source, target, outputWrite);

    const actualValues = outputWrite.toArray();
    const expectValues = [
      ['1', DASH, '2', DASH, '3'].join(''),
      ['1', DASH, '2', DASH, '3'].join(''),
      'abcdefghijklmnopqrstuvwxyz',
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      [
        '東京都',
        SPACE,
        '渋谷区',
        SPACE,
        '3丁目0',
        DASH,
        '0',
        DASH,
        '0',
      ].join(''),
    ];
    expect(expectValues.length).toBe(actualValues.length);
    expectValues.forEach((expectVal, i) => {
      expect(actualValues[i].tempAddress).toBe(expectVal);
    });
  });
});
