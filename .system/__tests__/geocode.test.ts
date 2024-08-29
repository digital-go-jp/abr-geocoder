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
}
const readCsvFile = async (filename: string) => {
  const results: {}[] = [];
  const reader = fs.createReadStream(`${__dirname}/../test-data/${filename}`, 'utf-8');
  return toCsvRows(reader);
}

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
}

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
