import { describe, expect, jest, test } from '@jest/globals';
import csvParser from 'csv-parser';
import { execaNode } from 'execa-cjs';
import fs, { read } from 'node:fs';
import path from 'node:path';
import { Writable } from 'node:stream';
import { OutputFormat } from '../../src/domain/types/output-format';

const SECONDS = 1000;
jest.setTimeout(5 * 60 * SECONDS);

const packageJsonPath = path.normalize(path.join(__dirname, '..', '..', 'package.json'));
const rootDir = path.dirname(packageJsonPath);
const dbPath = path.join(rootDir, 'db');
const cliPath = path.join(rootDir, 'build', 'interface', 'cli', 'cli.js');

const runGeocoder = (output: OutputFormat, execaOptions: {} = {}) => {
  return execaNode(execaOptions)(cliPath, [
    "-",
    "-silient",
    `-f ${output}`,
    `-d ${dbPath}`,
  ]);
};

const readJsonFile = (filename: string) => {
  const contents = fs.readFileSync(`${__dirname}/../test-data/${filename}`, 'utf-8');
  return JSON.parse(contents);
};

const readCsvFile = (filename: string) => {
  const reader = fs.createReadStream(`${__dirname}/../test-data/${filename}`, 'utf-8');
  return toCsvRows(reader);
};

const toCsvRows = (reader: NodeJS.ReadStream | fs.ReadStream) => {
  const results: {}[] = [];
  const parser = csvParser({
    skipComments: true,
  });
  const dst = new Writable({
    objectMode: true,
    write(chunk, _, callback) {
      results.push(chunk);
      callback();
    },
  });
  return new Promise((resolve: (results: {}[]) => void) => {
    reader
      .pipe(parser)
      .pipe(dst)
      .once('close', () => resolve(results));
  });
};

describe('General cases', () => {
  test('一般的なケースのテスト', async () => {
    const stdout = runGeocoder(OutputFormat.SIMPLIFIED, {
      inputFile: `${__dirname}/../test-data/general-cases/input.txt`,
    }).stdout as NodeJS.ReadStream;
    const results = await toCsvRows(stdout);

    const expectedOutput = await readCsvFile(`general-cases/expects.csv`);
    expect(results).toEqual(expectedOutput);
  });
  
  test('標準入力からのテスト', async () => {
    const input = '東京都千代田区紀尾井町1-3　デジタル庁';
    const { stdout } = await runGeocoder(OutputFormat.JSON, {
      input,
    });
    const expectedOutput = readJsonFile('general-cases/digital-agency.json');
    expect(JSON.parse(stdout)).toEqual(expectedOutput);
  });

});

describe('issues', () => {
  // test('#131: test', async () => {
  //   const { stdout } = await runGeocoder(OutputFormat.JSON, {
  //     input: '紀尾井町1一3 漢数字いち',
  //   });
  //   expect(JSON.parse(stdout)).toMatchObject([{
  //     "query": {
  //       "input": "紀尾井町1一3 漢数字いち"
  //     },
  //     "result": {
  //       "output": "東京都千代田区紀尾井町1-3 漢数字いち",
  //       "other": "漢数字いち",
  //       "score": 0.6,
  //       "match_level": "residential_detail",
  //       "coordinate_level": "residential_detail",
  //       "lat": 35.679107172,
  //       "lon": 139.736394597,
  //       "lg_code": "131016",
  //       "machiaza_id": "0056000",
  //       "rsdt_addr_flg": 1,
  //       "blk_id": "001",
  //       "rsdt_id": "003",
  //       "rsdt2_id": null,
  //       "prc_id": null,
  //       "pref": "東京都",
  //       "county": null,
  //       "city": "千代田区",
  //       "ward": null,
  //       "oaza_cho": "紀尾井町",
  //       "chome": null,
  //       "koaza": null,
  //       "blk_num": "1",
  //       "rsdt_num": 3,
  //       "rsdt_num2": null,
  //       "prc_num1": null,
  //       "prc_num2": null,
  //       "prc_num3": null
  //     }
  //   }]);
  // });
  test('#131: ハイフンのゆらぎ', async () => {
    const { stdout } = await runGeocoder(OutputFormat.JSON, {
      inputFile: `${__dirname}/../test-data/issue131/input.txt`,
    });
    const expectedOutput = readJsonFile(`issue131/expects.json`);
    expect(JSON.parse(stdout)).toEqual(expectedOutput);
  });

  test('#133: 「地割」が「koaza」に正規化されない', async () => {
    const { stdout } = await runGeocoder(OutputFormat.JSON, {
      inputFile: `${__dirname}/../test-data/issue133/input.txt`,
    });
    const expectedOutput = readJsonFile(`issue133/expects.json`);
    expect(JSON.parse(stdout)).toEqual(expectedOutput);
  });

  test('#122: 大字・町なし小字ありのパターンでマッチングできない', async () => {
    const { stdout } = await runGeocoder(OutputFormat.JSON, {
      inputFile: `${__dirname}/../test-data/issue122/input.txt`,
    });
    const expectedOutput = readJsonFile(`issue122/expects.json`);
    expect(JSON.parse(stdout)).toEqual(expectedOutput);
  });
  
  test('#123: 同一市区町村のある町字が別の町字に前方一致するパターン', async () => {
    const { stdout } = await runGeocoder(OutputFormat.JSON, {
      inputFile: `${__dirname}/../test-data/issue123/input.txt`,
    });
    const expectedOutput = readJsonFile(`issue123/expects.json`);
    expect(JSON.parse(stdout)).toEqual(expectedOutput);
  });

  test('#157: エッジケース：階数を含むケース', async () => {
    const { stdout } = await runGeocoder(OutputFormat.JSON, {
      inputFile: `${__dirname}/../test-data/issue157/input.txt`,
    });
    const expectedOutput = readJsonFile(`issue157/expects.json`);
    expect(JSON.parse(stdout)).toEqual(expectedOutput);
  });
  test('#166: 半角カタカナの「ｹ」がマッチしない', async () => {
    const { stdout } = await runGeocoder(OutputFormat.JSON, {
      inputFile: `${__dirname}/../test-data/issue166/input.txt`,
    });
    const expectedOutput = readJsonFile(`issue166/expects.json`);
    expect(JSON.parse(stdout)).toEqual(expectedOutput);
  });
});
