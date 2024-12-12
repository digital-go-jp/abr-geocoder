/*!
 * MIT License
 *
 * Copyright (c) 2024 デジタル庁
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
import { describe, expect, test } from '@jest/globals';
import {
  OutputFormat,
  SearchTarget
} from '../../src/index';
import { jsonTestRunner, readJsonFile, runGeocoder } from './common';

describe('General cases', () => {
  test('基本的なケースのテスト', async () => {
    await jsonTestRunner('basic-test-cases');
  });
  
  test('一般的なケースのテスト', async () => {
    await jsonTestRunner('general-test-cases');
  });
  
  test('京都通り名のテスト(1)', async () => {
    await jsonTestRunner('kyoto-fire-departments');
  });

  test('京都通り名のテスト(2)', async () => {
    await jsonTestRunner('kyoto-schools');
  });

  test('北海道札幌市のテスト', async () => {
    await jsonTestRunner('sapporo-schools');
  });

  test('v2.1でミスマッチした結果の確認', async () => {
    await jsonTestRunner('failed-v2.1');
  });

  test('特殊なケースのテスト', async () => {
    await jsonTestRunner('special-test-cases');
  });
  test('標準入力からのテスト', async () => {
    const input = '東京都千代田区紀尾井町1-3　デジタル庁';
    const { stdout } = await runGeocoder({
      input,
      geocode: {
        outputFormat: OutputFormat.JSON,
        searchTarget: SearchTarget.ALL,
      },
    });
    const expectedOutput = readJsonFile(`${__dirname}/../test-data/basic-test-cases/digital-agency.json`);
    expect(JSON.parse(stdout)).toMatchObject(expectedOutput);
  });

});
