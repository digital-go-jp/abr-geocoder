import { makeDirIfNotExists } from "@domain/services/make-dir-if-not-exists";
import { PrefInfo } from "@domain/types/geocode/pref-info";
import fs from 'node:fs';
import path from 'node:path';
import { jisKanji } from '../services/jis-kanji';
import { kan2num } from '../services/kan2num';
import { toHiragana } from '../services/to-hiragana';
import { AbrGeocoderDiContainer } from './abr-geocoder-di-container';
import { removeFiles } from "@domain/services/remove-files";
import { TrieAddressFinder2 } from "./trie/trie-finder2";
import { FileTrieWriter } from "./trie/file-trie-writer";
import { CreateCacheTaskParams } from "../services/worker/create-cache-params";
import { createSingleProgressBar } from "@domain/services/progress-bars/create-single-progress-bar";

export class PrefTrieFinder extends TrieAddressFinder2<PrefInfo> {

  private static normalize(value: string): string {
    // 半角カナ・全角カナ => 平仮名
    value = toHiragana(value);

    // JIS 第2水準 => 第1水準 及び 旧字体 => 新字体
    value = jisKanji(value);

    // 漢数字 => 算用数字
    value = kan2num(value);

    return value;
  }

  private static readonly getCacheFilePath = async (diContainer: AbrGeocoderDiContainer) => {
    makeDirIfNotExists(diContainer.cacheDir);
    const commonDb = await diContainer.database.openCommonDb();
    const genHash = commonDb.getPrefListGeneratorHash();

    return path.join(diContainer.cacheDir, `pref_${genHash}.abrg2`);
  };

  static readonly createDictionaryFile = async (task: CreateCacheTaskParams) => {
    const cacheFilePath = await PrefTrieFinder.getCacheFilePath(task.diContainer);

    // 古いキャッシュファイルを削除
    await removeFiles({
      dir: task.diContainer.cacheDir,
      filename: 'pref_.*\\.abrg2',
    });
    // キャッシュがなければ、Databaseからデータをロードして読み込む
    // キャッシュファイルも作成する
    const db = await task.diContainer.database.openCommonDb();
    if (!db) {
      return false;
    }

    const rows = await db.getPrefList()
    const writer = await FileTrieWriter.create(cacheFilePath);
    let i = 0;
    const progressBar = task.isSilentMode ? undefined : createSingleProgressBar(`pref: {bar} {percentage}% | {value}/{total} | ETA: {eta_formatted}`);
    progressBar?.start(rows.length, 0);
    while (i < rows.length) {
      const row = rows[i++];
      await writer.addNode({
        key: PrefTrieFinder.normalize(row.pref),
        value: row,
      });
      progressBar?.increment();
    }
    progressBar?.stop();
    await writer.close();
    await db.close();
    return true;
  };

  static readonly loadDataFile = async (task: CreateCacheTaskParams) => {
    const cacheFilePath = await PrefTrieFinder.getCacheFilePath(task.diContainer);
    let data: Buffer | undefined;
    let numOfTry: number = 0;
    while (!data && numOfTry < 3) {
      try {
        // TrieFinderが作成できればOK
        if (fs.existsSync(cacheFilePath)) {
          data = await fs.promises.readFile(cacheFilePath);
          const first100bytes = data.subarray(0, 100);
          new PrefTrieFinder(first100bytes);
          return data;
        }
      } catch (_e: unknown) {
        // Do nothing here
      }

      if (process.env.JEST_WORKER_ID) {
        console.log('Creates catch for PrefTrieFinder');
      }
      // 新しく作成
      if (!await PrefTrieFinder.createDictionaryFile(task)) {
        return;
      }
      numOfTry++;
    }
    return data;
  };
}
