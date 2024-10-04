import { describe, expect, jest, test } from '@jest/globals';
import { LineStream } from 'byline';
import { execaNode } from 'execa-cjs';
import fs from 'node:fs';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  AbrGeocodeStream,
  DEFAULT_FUZZY_CHAR,
  FormatterProvider,
  OutputFormat,
  SearchTarget,
  EnvProvider,
} from '../../src/index';

const SECONDS = 1000;
jest.setTimeout(5 * 60 * SECONDS);

const packageJsonPath = path.normalize(path.join(__dirname, '..', '..', 'package.json'));
const rootDir = path.dirname(packageJsonPath);
const dbPath = path.join(rootDir, 'db');
const cliPath = path.join(rootDir, 'build', 'interface', 'cli', 'cli.js');

// AbrGeocoderをメインスレッドのみで動作させたいので、
// 'test:e2e' をセットする
process.env.NODE_ENV = 'test:e2e';

const readJsonFile = (filename: string) => {
  const contents = fs.readFileSync(`${__dirname}/../test-data/${filename}`, 'utf-8');
  return JSON.parse(contents);
};

const runGeocoder = async (output: OutputFormat, execaOptions: { input?: string, inputFile?: string, } = {}) => {
  if (EnvProvider.isDebug) {
    // VSCode でデバッグする場合は、geocode-command.ts と同様の処理をすることで
    // ビルドしないでもデバッグできる
    const geocoderStream = await AbrGeocodeStream.create({
      fuzzy: DEFAULT_FUZZY_CHAR,
      searchTarget: SearchTarget.ALL,
      cacheDir: path.join(dbPath, 'cache'),
      database: {
        type: 'sqlite3',
        dataDir: path.join(dbPath, 'database'),
        schemaDir: path.join(rootDir, 'schemas', 'sqlite3'),
      },
      debug: false,
      progress(current: number) {},
    });

    const reader = (() => {
      if (execaOptions.input) {
        return Readable.from([execaOptions.input]);
      } else if (execaOptions.inputFile) {
        return fs.createReadStream(execaOptions.inputFile);
      } else {
        throw 'unknown input';
      }
    })();

    const formatter = FormatterProvider.get({
      type: output,
      debug: false,
    });

    const chunks: Buffer[] = [];
    const dst = new Writable({
      write(chunk, _, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
    });

    const lineByLine = new LineStream();

    await pipeline(
      reader,
      lineByLine,
      geocoderStream,
      formatter,
      dst,
    );

    return {
      stdout: Buffer.concat(chunks).toString('utf8'),
    };
  }

  // コマンドラインからテストを実行する場合は、CLIから行う
  return execaNode(execaOptions)(cliPath, [
    "-",
    "-silient",
    `-f ${output}`,
    `-d ${dbPath}`,
  ]);
};

const jsonTestRunner = async (testCaseName: string) => {
  const { stdout } = await runGeocoder(OutputFormat.JSON, {
    inputFile: `${__dirname}/../test-data/${testCaseName}/input.txt`,
  });

  const expectedOutput = readJsonFile(`${testCaseName}/expects.json`);
  expect(JSON.parse(stdout)).toMatchObject(expectedOutput);
}

describe('debug', () => {

  test('京都市上京区下立売通新町西入薮ノ内町', async () => {
    const input = '京都市上京区下立売通新町西入薮ノ内町';
    const { stdout } = await runGeocoder(OutputFormat.NDJSON, {
      input,
    });
    expect(JSON.parse(stdout)).toMatchObject({
      "query": {
        "input": "京都市上京区下立売通新町西入薮ノ内町"
      },
      "result": {
        "output": "京都府京都市上京区下立売通新町西入藪之内町",
        "other": null,
        "score": 0.77,
        "match_level": "machiaza_detail",
        "coordinate_level": "machiaza_detail",
        "lat": 35.02141,
        "lon": 135.755632,
        "lg_code": "261025",
        "machiaza_id": "0562102",
        "rsdt_addr_flg": 0,
        "blk_id": null,
        "rsdt_id": null,
        "rsdt2_id": null,
        "prc_id": null,
        "pref": "京都府",
        "county": null,
        "city": "京都市",
        "ward": "上京区",
        "oaza_cho": "藪之内町",
        "chome": null,
        "koaza": "下立売通新町西入",
        "blk_num": null,
        "rsdt_num": null,
        "rsdt_num2": null,
        "prc_num1": null,
        "prc_num2": null,
        "prc_num3": null
      }
    });
  });
});

describe('General cases', () => {
  test('基本的なケースのテスト', async () => {
    await jsonTestRunner('basic-test-cases');
  });
  
  test('一般的なケースのテスト', async () => {
    await jsonTestRunner('general-test-cases');
  });
  
  test('京都通り名のテスト', async () => {
    await jsonTestRunner('kyoto-street-name-cases');
  });

  test('標準入力からのテスト', async () => {
    const input = '東京都千代田区紀尾井町1-3　デジタル庁';
    const { stdout } = await runGeocoder(OutputFormat.JSON, {
      input,
    });
    const expectedOutput = readJsonFile('basic-test-cases/digital-agency.json');
    expect(JSON.parse(stdout)).toEqual(expectedOutput);
  });

});

describe('issues', () => {
  test('#131: ハイフンのゆらぎ', async () => {
    await jsonTestRunner('issue131');
  });

  test('#133: 「地割」が「koaza」に正規化されない', async () => {
    await jsonTestRunner('issue133');
  });

  test('#122: 大字・町なし小字ありのパターンでマッチングできない', async () => {
    await jsonTestRunner('issue122');
  });
  
  test('#123: 同一市区町村のある町字が別の町字に前方一致するパターン', async () => {
    await jsonTestRunner('issue123');
  });

  test('#157: エッジケース：階数を含むケース', async () => {
    await jsonTestRunner('issue157');
  });
  test('#166: 半角カタカナの「ｹ」がマッチしない', async () => {
    await jsonTestRunner('issue166');
  });
});
