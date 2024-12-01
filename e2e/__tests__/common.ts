import { expect, jest } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  AbrGeocoder,
  AbrGeocoderDiContainer,
  AbrGeocoderStream,
  CommentFilterTransform,
  DEFAULT_FUZZY_CHAR,
  EnvProvider,
  FormatterProvider,
  LineStream,
  OutputFormat,
  SearchTarget
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

export const readJsonFile = (filepath: string) => {
  const contents = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(contents);
};

export type GeocoderOptions = {
  outputFormat: OutputFormat;
  searchTarget: SearchTarget;
};

export type ExecOptions = {
  input?: string;
  inputFile?: string;
  geocode: GeocoderOptions,
  useGlobalDB?: boolean;
};

export const runGeocoder = async (options: ExecOptions) => {

  // 読み込みストリーム
  const reader = (() => {
    if (options.input) {
      return Readable.from([options.input]);
    } else if (options.inputFile) {
      return fs.createReadStream(options.inputFile);
    } else {
      throw 'unknown input';
    }
  })();

  // 1行ずつに分解するストリーム
  const lineByLine = new LineStream();

  // コメントを取り除くストリーム
  const commentFilter = new CommentFilterTransform();

  if (process.env.USE_HTTP) {
    // ===========================================
    // E2Eテスト時は、HTTPリクエストで処理を行う
    // ===========================================
    const format = ((): OutputFormat => {
      switch (options.geocode.outputFormat) {
        case OutputFormat.JSON: {
          return OutputFormat.NDJSON;
        }
        case OutputFormat.GEOJSON: {
          return OutputFormat.NDGEOJSON;
        }
        default: {
          return options.geocode.outputFormat;
        }
      }
    })();

    const chunks: string[] = [];
    const requester = new Writable({
      objectMode: true,
      async write(
        address: string, 
        _: BufferEncoding,
        callback: (error?: Error | null | undefined) => void,
      ) {

        const query_params = new URLSearchParams({
          // 検索対象の住所文字列
          address,

          // 検索対象
          target: options.geocode.searchTarget,

          // 出力書式
          format,
        });
        const response = await fetch(`http://localhost:3000/geocode?${query_params}`, {
          keepalive: true,
        });

        if (!response.ok) {
          callback(new Error(`${response.status}: ${response.statusText}`));
          return;
        }
        if (format === OutputFormat.CSV || format === OutputFormat.SIMPLIFIED) {
          chunks.push(await response.text());
          return;
        }
        chunks.push(JSON.stringify(await response.json()));
        callback();
      },
    })

    await pipeline(
      reader,
      lineByLine,
      commentFilter,
      requester,
    )

    if (format === OutputFormat.JSON || format === OutputFormat.GEOJSON) {
      return {
        stdout: `[${chunks.join(",")}]`,
      }
    }
    return {
      stdout: chunks.join("\n")
    };
  }

  // ===================================================
  // VSCodeでデバッグする場合は、同じプロセス上で処理を行う。
  //
  // geocode-command.ts と同様の処理をすることで
  // ビルドしないでもデバッグできる
  // ===================================================
  const abrgDir = options.useGlobalDB ? resolveHome(EnvProvider.DEFAULT_ABRG_DIR) : dbPath;
  
  const container = new AbrGeocoderDiContainer({
    cacheDir: path.join(abrgDir, 'cache'),
    database: {
      type: 'sqlite3',
      dataDir: path.join(abrgDir, 'database'),
    },
    debug: false,
  });
  
  const geocoder = await AbrGeocoder.create({
    container,
    numOfThreads: 1,
  });

  // ジオコーディング・ストリーマの作成
  const geocoderStream = new AbrGeocoderStream({
    geocoder,
    fuzzy: DEFAULT_FUZZY_CHAR,
    searchTarget: options.geocode.searchTarget,
  });

  const formatter = FormatterProvider.get({
    type: options.geocode.outputFormat,
    debug: false,
  });

  // 書き込みストリーム
  const chunks: Buffer[] = [];
  const dst = new Writable({
    write(chunk, _, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });

  await pipeline(
    reader,
    lineByLine,
    commentFilter,
    geocoderStream,
    formatter,
    dst,
  );

  return {
    stdout: Buffer.concat(chunks).toString('utf8'),
  };
};

export const testRunner = async (options: {
  inputFile: string;
  expectFile: string;
  geocode: GeocoderOptions,
}) => {
  const { stdout } = await runGeocoder({
    inputFile: options.inputFile,
    geocode: options.geocode,
  });

  const expectedOutput = readJsonFile(options.expectFile);
  expect(JSON.parse(stdout)).toMatchObject(expectedOutput);
};

export const jsonTestRunner = async (testCaseName: string) => {
  const testdir = `${__dirname}/../test-data/${testCaseName}`;
  await testRunner({
    inputFile: `${testdir}/input.txt`,
    expectFile: `${testdir}/expects.json`,
    geocode: {
      outputFormat: OutputFormat.JSON,
      searchTarget: SearchTarget.ALL,
    },
  });
};

export const resolveHome = (filepath: string): string => {
  if (!filepath || filepath[0] !== '~') {
    return filepath;
  }
  return path.join(os.homedir(), filepath.slice(1));
};
