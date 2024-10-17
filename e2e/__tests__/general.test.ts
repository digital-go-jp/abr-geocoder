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
