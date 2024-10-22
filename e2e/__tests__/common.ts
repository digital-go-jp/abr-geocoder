import { expect, jest } from '@jest/globals';
import { execaNode } from 'execa-cjs';
import fs from 'node:fs';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  AbrGeocodeStream,
  DEFAULT_FUZZY_CHAR,
  EnvProvider,
  FormatterProvider,
  LineStream,
  OutputFormat,
  SearchTarget,
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
};

export const runGeocoder = async (options: ExecOptions) => {
  if (EnvProvider.isDebug) {
    // VSCode でデバッグする場合は、geocode-command.ts と同様の処理をすることで
    // ビルドしないでもデバッグできる
    const geocoderStream = await AbrGeocodeStream.create({
      fuzzy: DEFAULT_FUZZY_CHAR,
      searchTarget: options.geocode.searchTarget,
      cacheDir: path.join(dbPath, 'cache'),
      database: {
        type: 'sqlite3',
        dataDir: path.join(dbPath, 'database'),
      },
      debug: false,
      progress(current: number) {},
    });

    const reader = (() => {
      if (options.input) {
        return Readable.from([options.input]);
      } else if (options.inputFile) {
        return fs.createReadStream(options.inputFile);
      } else {
        throw 'unknown input';
      }
    })();

    const formatter = FormatterProvider.get({
      type: options.geocode.outputFormat,
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
  return execaNode(options)(cliPath, [
    "-",
    "-silient",
    `--target ${options.geocode.searchTarget}`,
    `-f ${options.geocode.outputFormat}`,
    `-d ${dbPath}`,
  ]);
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
