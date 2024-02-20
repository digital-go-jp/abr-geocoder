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
import { Query } from '@domain/query';
import { describe, expect, it } from '@jest/globals';
import { DASH, DOUBLE_QUOTATION, SINGLE_QUOTATION, SPACE } from '@settings/constant-values';
import Stream from 'node:stream';
import { GeocodingStep1 } from '../step1-transform';
import { WritableStreamToArray } from './stream-to-array.skip';

describe('step1-transform', () => {

  it.concurrent('同じクォーテーションが先頭と末尾にあるときのみ、取り除く', async () => {
    const results = await execStereamTest([
      `"1-2-3"`,
      '"4-5-6',
      '７−８−９"',
      "'ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ'",
      "'ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ",
      "ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ'",
      '東京都千代田区紀尾井町1-3, "19,20F"',
      "\"ABC\'",
    ]);

    const expectValues = [
      // 先頭1文字と末尾1文字がダブルクォーテーションの場合は、それらを取り除く
      ['1', DASH, '2', DASH, '3'].join(''),

      // 先頭1文字のみがダブルクォーテーションの場合は残す
      [DOUBLE_QUOTATION, '4', DASH, '5', DASH, '6'].join(''),

      // 末尾1文字のみがダブルクォーテーションは残す
      ['7', DASH, '8', DASH, '9', DOUBLE_QUOTATION].join(''),

      // 先頭1文字と末尾1文字がシングルクォーテーションの場合は、それらを取り除く
      'abcdefghijklmnopqrstuvwxyz',

      // 先頭1文字のみがシングルクォーテーションの場合は残す
      [SINGLE_QUOTATION, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].join(''),
      
      // 末尾1文字のみがシングルクォーテーションは残す
      ['ABCDEFGHIJKLMNOPQRSTUVWXYZ', SINGLE_QUOTATION].join(''),

      // 途中でダブルクォーテーションが出現する場合は残す
      ['東京都千代田区紀尾井町1', DASH, '3,', SPACE ,'"19,20F"'].join(''),

      // 先頭1文字と末尾1文字がクォーテーションが異なる場合は残す
      "\"ABC\'"
    ];

    verifyResults(results, expectValues);
  })

  it.concurrent('全角・全角スペースを半角にする', async () => {
    const results = await execStereamTest([
      'a b',
      'c　d',
      'e　 　f',
      '　Ａ　Ｂ Ｃ　　Ｄ   Ｅ　',
    ])

    const expectValues = [
      ['a', SPACE, 'b'].join(''),
      ['c', SPACE, 'd'].join(''),
      ['e', SPACE, 'f'].join(''),
      ['A', SPACE, 'B', SPACE, 'C', SPACE, 'D', SPACE, 'E'].join(''),
    ];

    verifyResults(results, expectValues);
  });

  it.concurrent('全角英数字を半角にする', async () => {
    const results = await execStereamTest([
      '1-2-3',
      '１−２−３',
      'ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ',
      'ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ',
      '東京都　　　 　渋谷区　３丁目０−０−０',
    ])

    const expectValues = [
      ['1', DASH, '2', DASH, '3'].join(''),
      ['1', DASH, '2', DASH, '3'].join(''),
      'abcdefghijklmnopqrstuvwxyz',
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      ['東京都渋谷区3丁目0',DASH,'0',DASH,'0'].join(''),
    ];

    verifyResults(results, expectValues);
  });

  it.concurrent('"(数字・漢数字)-", "-(数字・漢数字)"のハイフンをDASHにする', async () => {
    const results = await execStereamTest([
      '1-2-3',
      '四−五−六  あ‒‒‒う',  // 最後の ‒（フィギュアダッシュ） はそのまま。
      '一７-８', // 一が漢数字の「1」なので、そのまま。
      '二─', // ─ が罫線
      '東京都渋谷区３丁目０━０⎯０', // ━が罫線（大）、⎯が罫線(?)
    ])

    const expectValues = [
      ['1', DASH, '2', DASH, '3'].join(''),
      ['四', DASH, '五', DASH, '六', SPACE, 'あ‒‒‒う'].join(''),
      ['一7', DASH, '8'].join(''),
      ['二', DASH].join(''),
      ['東京都渋谷区3丁目0',DASH,'0',DASH,'0'].join(''),
    ];

    verifyResults(results, expectValues);
  });

  it.concurrent('町丁目名以前のスペースはすべて削除', async () => {
    const results = await execStereamTest([
      '東京都 渋谷区　　　3丁目　１−２−３',
    ])

    const expectValues = [
      ['東京都渋谷区3丁目', '1', DASH, '2', DASH, '3'].join(''),
    ];

    verifyResults(results, expectValues);
  });

  it.concurrent('区、郡以前のスペースはすべて削除', async () => {
    const results = await execStereamTest([
      '　　　東京都 渋谷区',
      '大島郡 大和村',
      '大阪市 北区 扇町 2丁目 1番 27号',
      '  鹿児島県 志布志市 志布 志町 志布 志 二丁目 1番 1号 ',
    ])

    const expectValues = [
      ['東京都', SPACE, '渋谷区'].join(''),
      '大島郡大和村',
      ['大阪市北区扇町2丁目', SPACE, '1番', SPACE, '27号'].join(''),
      ['鹿児島県志布志市志布志町志布志二丁目', SPACE, '1番', SPACE, '1号'].join(''),
    ];

    verifyResults(results, expectValues);
  });

  it.concurrent('一番はじめに出てくるアラビア数字以前のスペースを削除', async () => {
    const results = await execStereamTest([
      '　　　1 2 3　　　',
    ])

    const expectValues = [
      ['1', SPACE, '2', SPACE, '3'].join(''),
    ];

    verifyResults(results, expectValues);
  });
});

const verifyResults = (results: Query[], expectTempAddressList: string[]) => {
  expect(expectTempAddressList.length).toBe(results.length);

  expectTempAddressList.forEach((expectVal, i) => {
    expect(results[i].tempAddress).toBe(expectVal);
  });
}

const execStereamTest = async (inputs: string[]): Promise<Query[]> => {
  const queries = inputs.map(input => Query.create(input));
  const source = Stream.Readable.from(queries, {
    objectMode: true,
  });

  const target = new GeocodingStep1();
  const outputWrite = new WritableStreamToArray<Query>();
  await Stream.promises.pipeline(source, target, outputWrite);

  return outputWrite.toArray();
}
