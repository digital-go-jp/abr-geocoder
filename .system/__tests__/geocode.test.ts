import { describe, expect, jest, test } from '@jest/globals';
import { LineStream } from 'byline';
import { execaNode } from 'execa-cjs';
import fs from 'node:fs';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { AbrGeocodeStream, DEFAULT_FUZZY_CHAR, FormatterProvider, OutputFormat, SearchTarget } from '../../src/index';

const SECONDS = 1000;
jest.setTimeout(5 * 60 * SECONDS);

const packageJsonPath = path.normalize(path.join(__dirname, '..', '..', 'package.json'));
const rootDir = path.dirname(packageJsonPath);
const dbPath = path.join(rootDir, 'db');
const cliPath = path.join(rootDir, 'build', 'interface', 'cli', 'cli.js');

// @ts-expect-error ts-node で実行しているときは、 NODE_ENV = 'test:system' にする
if ((process as unknown)[Symbol.for('ts-node.register.instance')]) {
  process.env.NODE_ENV = 'test:system';
}

const readJsonFile = (filename: string) => {
  const contents = fs.readFileSync(`${__dirname}/../test-data/${filename}`, 'utf-8');
  return JSON.parse(contents);
};

const runGeocoder = async (output: OutputFormat, execaOptions: { input?: string, inputFile?: string, } = {}) => {
  if (process.env.NODE_ENV === 'test') {
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
  test('北海道札幌市白石区平和通１丁目南６番１６号', async () => {
    const input = '北海道札幌市白石区平和通１丁目南６番１６号';
    const { stdout } = await runGeocoder(OutputFormat.NDJSON, {
      input,
    });
    expect(JSON.parse(stdout)).toMatchObject({
      "query": {
        "input": "北海道札幌市白石区平和通１丁目南６番１６号"
      },
      "result": {
        "output": "北海道札幌市白石区平和通一丁目南6-16",
        "other": null,
        "match_level": "residential_detail",
        "coordinate_level": "residential_detail",
        "lat": 43.054140181,
        "lon": 141.407126409,
        "lg_code": "011045",
        "machiaza_id": "0099102",
        "blk_id": "006",
        "blk_num": "6",
        "rsdt_id": "016",
        "rsdt2_id": null,
        "prc_id": null,
        "pref": "北海道",
        "county": null,
        "city": "札幌市",
        "ward": "白石区",
        "oaza_cho": "平和通",
        "chome": null,
        "koaza": "一丁目南",
        "rsdt_num": 16,
        "rsdt_num2": null,
        "prc_num1": null,
        "prc_num2": null,
        "prc_num3": null
      }
    });
  });

  test('北海道札幌市北区北２４条西７丁目１番１０号', async () => {
    const input = '北海道札幌市北区北２４条西７丁目１番１０号';
    const { stdout } = await runGeocoder(OutputFormat.NDJSON, {
      input,
    });
    expect(JSON.parse(stdout)).toMatchObject({
      "query": {
        "input": "北海道札幌市北区北２４条西７丁目１番１０号"
      },
      "result": {
        "output": "北海道札幌市北区北二十四条西七丁目1-10",
        "other": "-10",
        "match_level": "residential_block",
        "coordinate_level": "residential_block",
        "lat": 43.090336,
        "lon": 141.33904,
        "lg_code": "011029",
        "machiaza_id": "0021007",
        "rsdt_addr_flg": 1,
        "blk_id": "001",
        "rsdt_id": null,
        "rsdt2_id": null,
        "prc_id": null,
        "pref": "北海道",
        "county": null,
        "city": "札幌市",
        "ward": "北区",
        "oaza_cho": "北二十四条西",
        "chome": "七丁目",
        "koaza": null,
        "blk_num": "1",
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
