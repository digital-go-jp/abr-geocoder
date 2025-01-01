import { DASH } from "@config/constant-values";
import { makeDirIfNotExists } from "@domain/services/make-dir-if-not-exists";
import { RegExpEx } from "@domain/services/reg-exp-ex";
import { removeFiles } from "@domain/services/remove-files";
import { CityMatchingInfo } from "@domain/types/geocode/city-info";
import fs from 'node:fs';
import path from 'node:path';
import { jisKanji } from '../services/jis-kanji';
import { kan2num } from '../services/kan2num';
import { toHiragana } from '../services/to-hiragana';
import { AbrGeocoderDiContainer } from './abr-geocoder-di-container';
import { TrieAddressFinder2 } from "./trie/trie-finder2";
import { FileTrieWriter } from "./trie/file-trie-writer";
import { CreateCacheTaskParams } from "../services/worker/create-cache-params";

export class Tokyo23WardTrieFinder extends TrieAddressFinder2<CityMatchingInfo> {

  static normalize(address: string): string {
    // 片仮名を平仮名に変換する
    address = toHiragana(address);

    // 漢数字を半角数字に変換する
    address = kan2num(address);
    
    // JIS 第2水準 => 第1水準 及び 旧字体 => 新字体
    address = jisKanji(address);

    // 〇〇番地[〇〇番ー〇〇号]、の [〇〇番ー〇〇号] だけを取る
    address = address?.replaceAll(RegExpEx.create(`(\\d+)${DASH}?[番号町地丁目]+の?`, 'g'), `$1${DASH}`);

    return address;
  }

  private static readonly getCacheFilePath = async (diContainer: AbrGeocoderDiContainer) => {
    makeDirIfNotExists(diContainer.cacheDir);
    const commonDb = await diContainer.database.openCommonDb();
    const genHash = commonDb.getTokyo23WardsGeneratorHash();

    return path.join(diContainer.cacheDir, `tokyo23-ward_${genHash}.abrg2`);
  };

  static readonly createDictionaryFile = async (task: CreateCacheTaskParams) => {
    const cacheFilePath = await Tokyo23WardTrieFinder.getCacheFilePath(task.diContainer);

    // 古いキャッシュファイルを削除
    await removeFiles({
      dir: task.diContainer.cacheDir,
      filename: 'tokyo23-ward_.*\\.abrg2',
    });
    
    // キャッシュがなければ、Databaseからデータをロードして読み込む
    // キャッシュファイルも作成する
    const db = await task.diContainer.database.openCommonDb();
    if (!db) {
      return false;
    }
    const rows = await db.getTokyo23Wards();
    const writer = await FileTrieWriter.create(cacheFilePath);
    let i = 0;
    while (i < rows.length) {
      const row = rows[i++];
      await writer.addNode({
        key: Tokyo23WardTrieFinder.normalize(row.key),
        value: row,
      });
    }
    await writer.close();
    await db.close();
    return true;
  };

  static readonly loadDataFile = async (task: CreateCacheTaskParams) => {
    const cacheFilePath = await Tokyo23WardTrieFinder.getCacheFilePath(task.diContainer);
    let data: Buffer | undefined;
    let numOfTry: number = 0;
    while (!data && numOfTry < 3) {
      try {
        // TrieFinderが作成できればOK
        if (fs.existsSync(cacheFilePath)) {
          data = await fs.promises.readFile(cacheFilePath);
          const first100bytes = data.subarray(0, 100);
          new Tokyo23WardTrieFinder(first100bytes);
          return data;
        }
      } catch (_e: unknown) {
        // Do nothing here
      }

      if (process.env.JEST_WORKER_ID) {
        console.log('Creates catch for Tokyo23WardTrieFinder');
      }
      // 新しく作成
      if (!await Tokyo23WardTrieFinder.createDictionaryFile(task)) {
        return;
      }
      numOfTry++;
    }
    return data;
  };
}
