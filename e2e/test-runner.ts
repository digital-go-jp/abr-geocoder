import { $, execaNode } from 'execa-cjs';
import path from 'node:path';
import fs from 'node:fs';
const packageJsonPath = path.normalize(path.join(__dirname, '..', 'package.json'));
const rootDir = path.dirname(packageJsonPath);
const dbPath = path.join(rootDir, 'db');
const cliPath = path.join(rootDir, 'build', 'interface', 'cli', 'cli.js');

const gatheringLgCode = async (targetDir: string): Promise<Set<string>> => {
  const results: Set<string> = new Set();
  const dir = await fs.promises.opendir(targetDir);
  for await (const dirent of dir) {
    // ディレクトリの場合は再帰呼び出し
    if (dirent.isDirectory()) {
      if (dirent.name === '.' || dirent.name === '..') {
        continue;
      }
      const others = await gatheringLgCode(path.join(dir.path, dirent.name));
      for (const other of others.values()) {
        results.add(other);
      }
      continue;
    }

    // JSONファイルなら、lg_codeを探す
    if (!dirent.name.endsWith('.json')) {
      continue;
    }
    const fileContents = fs.readFileSync(path.join(dir.path, dirent.name), {
      encoding: 'utf-8',
    });
    const expectValues: { result: { lg_code: string; }}[] = JSON.parse(fileContents);
    for (const entry of expectValues) {
      results.add(entry.result.lg_code);
    }
  }
  return results;
};

(async () => {
  // ビルド
  await $({ stdout: 'inherit', stderr: 'inherit' })`npm run build`;

  // test-dataディレクトリの各jsonファイルから、lg_codeを収集する
  const lgCodes = await gatheringLgCode(path.join(__dirname, 'test-data'));

  // キャッシュの削除
  await $({ stdout: 'inherit', stderr: 'inherit' })`npx rimraf ${dbPath}/cache`;
  
  // Databaseの削除
  await $({ stdout: 'inherit', stderr: 'inherit' })`npx rimraf ${dbPath}/database`;

  // ダウンロード
  await $({ stdout: 'inherit', stderr: 'inherit' })`node ${cliPath} download -c ${Array.from(lgCodes).join(' ')} -d ${dbPath}`;

  const controller = new AbortController();
  try {
    const serverTaskPromise = $({
      stdout: 'inherit',
      stderr: 'inherit',
      cancelSignal: controller.signal,
      detached: true,
      env: {
        USE_HTTP: 'true',
      }
    })`node ${cliPath} serve -d ${dbPath}`;

    // --runInBand はファイルを1つずつテストするためのオプション
    await $({ stdout: 'inherit', stderr: 'inherit' })`npx jest --config ${rootDir}/jest.e2e.config.js --runInBand`
    controller.abort();

    await serverTaskPromise;

  } catch (error) {
    if (controller.signal.aborted) {
      return;
    }
    throw error;
  }
  
})();
