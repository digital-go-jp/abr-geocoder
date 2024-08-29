import { describe, expect, jest, test } from '@jest/globals';
import { execaNode } from 'execa-cjs';
import fs from 'node:fs';
import path from 'node:path';

const SECONDS = 1000;
jest.setTimeout(5 * 60 * SECONDS);

const packageJsonPath = path.normalize(path.join(__dirname, '..', '..', 'package.json'));
const rootDir = path.dirname(packageJsonPath);
const dbPath = path.join(rootDir, 'db');
const cliPath = path.join(rootDir, 'build', 'interface', 'cli', 'cli.js');

const execCLI = (execaOptions: {}) => {
  return execaNode(execaOptions)(cliPath, [
    "-",
    "-silient",
    `-d ${dbPath}`,
  ]);
}

const readJsonFile = (filename: string) => {
  const contents = fs.readFileSync(`${__dirname}/../test-data/${filename}`, 'utf-8');
  return JSON.parse(contents);
}
describe('Normal cases', () => {
  test('1件だけテスト', async () => {
    const input = '東京都千代田区紀尾井町1-3　東京ガーデンテラス紀尾井町 19階、20階';
    const { stdout } = await execCLI({
      input,
    });
    const expectedOutput = readJsonFile('デジタル庁.json');
    expect(JSON.parse(stdout)).toEqual(expectedOutput);
  });
});

describe('issues', () => {
  test('#133: 「地割」が「koaza」に正規化されない', async () => {
    const { stdout } = await execCLI({
      inputFile: `${__dirname}/../test-data/issue133/input.txt`,
    });
    const expectedOutput = readJsonFile(`issue133/expected.json`);
    expect(JSON.parse(stdout)).toEqual(expectedOutput);
  });
  test('#157: エッジケース：階数を含むケース', async () => {
    const { stdout } = await execCLI({
      inputFile: `${__dirname}/../test-data/issue157/input.txt`,
    });
    const expectedOutput = readJsonFile(`issue157/expected.json`);
    expect(JSON.parse(stdout)).toEqual(expectedOutput);
  });
  test('#166: 半角カタカナの「ｹ」がマッチしない', async () => {
    const { stdout } = await execCLI({
      inputFile: `${__dirname}/../test-data/issue166/input.txt`,
    });
    const expectedOutput = readJsonFile(`issue166/expected.json`);
    expect(JSON.parse(stdout)).toEqual(expectedOutput);
  });
});
