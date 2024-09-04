import { describe, expect, jest, test } from '@jest/globals';
import { execaNode } from 'execa-cjs';
import fs from 'node:fs';
import path from 'node:path';
import { OutputFormat } from '../../src/domain/types/output-format';

const SECONDS = 1000;
jest.setTimeout(5 * 60 * SECONDS);

const packageJsonPath = path.normalize(path.join(__dirname, '..', '..', 'package.json'));
const rootDir = path.dirname(packageJsonPath);
const dbPath = path.join(rootDir, 'db');
const cliPath = path.join(rootDir, 'build', 'interface', 'cli', 'cli.js');

// // @ts-expect-error ts-node で実行しているときは、 NODE_ENV = 'test' にする
// if ((process as unknown)[Symbol.for('ts-node.register.instance')]) {
//   process.env.NODE_ENV = 'test';
// }

const readJsonFile = (filename: string) => {
  const contents = fs.readFileSync(`${__dirname}/../test-data/${filename}`, 'utf-8');
  return JSON.parse(contents);
};

const runGeocoder = (output: OutputFormat, execaOptions: { input?: string, inputFile?: string, } = {}) => {
  // if (process.env.NODE_ENV === 'test') {

  //   const geocoderStream = await AbrGeocodeStream.create({
  //     fuzzy: DEFAULT_FUZZY_CHAR,
  //     searchTarget: SearchTarget.ALL,
  //     cacheDir: path.join(dbPath, 'cache'),
  //     database: {
  //       type: 'sqlite3',
  //       dataDir: path.join(dbPath, 'database'),
  //       schemaDir: path.join(dbPath, 'schemas', 'sqlite3'),
  //     },
  //     debug: false,
  //     progress(current: number) {},
  //   });

  //   const buffer: string[] = [];
  //   const reader = (() => {
  //     if (execaOptions.input) {
  //       return Readable.from([execaOptions.input]);
  //     } else if (execaOptions.inputFile) {
  //       return fs.createReadStream(execaOptions.inputFile);
  //     } else {
  //       throw 'unknown input';
  //     }
  //   })();
  //   const dst = new Writable({
  //     write(chunk, _, callback) {
  //       buffer.push(chunk.toString());
  //       callback();
  //     },
  //   });

  //   return new Promise((resolve: (result: {stdout: string}) => void) => {
  //     reader.pipe(geocoderStream).pipe(dst).once("finish", () => {
  //       resolve({
  //         stdout: buffer.join(''),
  //       });
  //     })
  //   });

  //   // return execa(execaOptions)`npx ts-node ${cliTsPath} - -f ${output} -d ${dbPath}`;
  // }

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
  test('霞ヶ関', async () => {
    const input = '霞ヶ関';
    const { stdout } = await runGeocoder(OutputFormat.NDJSON, {
      input,
    });
    expect(JSON.parse(stdout)).toMatchObject({
      "query": {
        "input": "霞ヶ関"
      },
      "result": {
        "output": "東京都千代田区霞が関",
        "other": null,
        "score": 0.2,
        "match_level": "machiaza",
        "coordinate_level": "city",
        "lat": 35.694003,
        "lon": 139.753634,
        "lg_code": "131016",
        "machiaza_id": "0002000",
        "rsdt_addr_flg": -1,
        "blk_id": null,
        "rsdt_id": null,
        "rsdt2_id": null,
        "prc_id": null,
        "pref": "東京都",
        "county": null,
        "city": "千代田区",
        "ward": null,
        "oaza_cho": "霞が関",
        "chome": null,
        "koaza": null,
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
