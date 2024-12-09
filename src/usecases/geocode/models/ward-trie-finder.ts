import { makeDirIfNotExists } from "@domain/services/make-dir-if-not-exists";
import { removeFiles } from "@domain/services/remove-files";
import { WardMatchingInfo } from "@domain/types/geocode/ward-info";
import fs from 'node:fs';
import path from 'node:path';
import { jisKanji } from '../services/jis-kanji';
import { toHankakuAlphaNum } from "../services/to-hankaku-alpha-num";
import { toHiragana } from '../services/to-hiragana';
import { AbrGeocoderDiContainer } from './abr-geocoder-di-container';
import { TrieAddressFinder2 } from "./trie/trie-finder2";
import { FileTrieWriter } from "./trie/file-trie-writer";
import { createSingleProgressBar } from "@domain/services/progress-bars/create-single-progress-bar";
import { CreateCacheTaskParams } from "../services/worker/create-cache-params";

export class WardTrieFinder extends TrieAddressFinder2<WardMatchingInfo> {

  static readonly normalize = (address: string): string => {
    // 漢数字を半角英数字にする
    address = toHankakuAlphaNum(address);

    // JIS 第2水準 => 第1水準 及び 旧字体 => 新字体
    address = jisKanji(address);

    // カタカナは全てひらがなにする（南アルプス市）
    address = toHiragana(address);
    return address;
  };

  private static readonly getCacheFilePath = async (diContainer: AbrGeocoderDiContainer) => {
    makeDirIfNotExists(diContainer.cacheDir);
    const commonDb = await diContainer.database.openCommonDb();
    const genHash = commonDb.getWardsGeneratorHash();

    return path.join(diContainer.cacheDir, `ward_${genHash}.abrg2`);
  };

  static readonly createDictionaryFile = async (task: CreateCacheTaskParams) => {
    const cacheFilePath = await WardTrieFinder.getCacheFilePath(task.diContainer);

    // 古いキャッシュファイルを削除
    await removeFiles({
      dir: task.diContainer.cacheDir,
      filename: 'ward_.*\\.abrg2',
    });
    
    // キャッシュがなければ、Databaseからデータをロードして読み込む
    // キャッシュファイルも作成する
    const db = await task.diContainer.database.openCommonDb();
    if (!db) {
      return false;
    }
    const rows = await db.getWards();
    const writer = await FileTrieWriter.create(cacheFilePath);
    let i = 0;
    const progressBar = task.isSilentMode ? undefined : createSingleProgressBar(`ward: {bar} {percentage}% | {value}/{total} | ETA: {eta_formatted}`);
    progressBar?.start(rows.length, 0);
    while (i < rows.length) {
      const row = rows[i++];
      await writer.addNode({
        key: WardTrieFinder.normalize(row.key),
        value: row,
      });
      // partial match させるために、〇〇区だけでも登録する
      await writer.addNode({
        key: WardTrieFinder.normalize(row.ward),
        value: row,
      });
    }
    progressBar?.stop();
    await writer.close();
    await db.close();
    return true;
  };

  static readonly loadDataFile = async (task: CreateCacheTaskParams) => {
    const cacheFilePath = await WardTrieFinder.getCacheFilePath(task.diContainer);
    let data: Buffer | undefined;
    let numOfTry: number = 0;
    while (!data && numOfTry < 3) {
      try {
        // TrieFinderが作成できればOK
        if (fs.existsSync(cacheFilePath)) {
          data = await fs.promises.readFile(cacheFilePath);
          const first100bytes = data.subarray(0, 100);
          new WardTrieFinder(first100bytes);
          return data;
        }
      } catch (_e: unknown) {
        // Do nothing here
      }

      if (process.env.JEST_WORKER_ID) {
        console.log('Creates catch for WardTrieFinder');
      }
      // 新しく作成
      if (!await WardTrieFinder.createDictionaryFile(task)) {
        return;
      }
      numOfTry++;
    }
    return data;
  };
}
