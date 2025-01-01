import { makeDirIfNotExists } from "@domain/services/make-dir-if-not-exists";
import { CityMatchingInfo } from "@domain/types/geocode/city-info";
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

export class CountyAndCityTrieFinder extends TrieAddressFinder2<CityMatchingInfo> {

  static normalize(value: string): string {
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
    const genHash = commonDb.getCountyAndCityListGeneratorHash();

    return path.join(diContainer.cacheDir, `county-and-city_${genHash}.abrg2`);
  };

  static readonly createDictionaryFile = async (task: CreateCacheTaskParams) => {
    const cacheFilePath = await CountyAndCityTrieFinder.getCacheFilePath(task.diContainer);

    // 古いキャッシュファイルを削除
    await removeFiles({
      dir: task.diContainer.cacheDir,
      filename: 'county-and-city_.*\\.abrg2',
    });
    
    // キャッシュがなければ、Databaseからデータをロードして読み込む
    // キャッシュファイルも作成する
    const db = await task.diContainer.database.openCommonDb();
    if (!db) {
      return false;
    }

    const rows = await db.getCountyAndCityList();
    const writer = await FileTrieWriter.create(cacheFilePath);
    let i = 0;
    while (i < rows.length) {
      const row = rows[i++];
      await writer.addNode({
        key: CountyAndCityTrieFinder.normalize(row.key),
        value: row,
      });
    }
    await writer.close();
    await db.close();
    return true;
  };

  static readonly loadDataFile = async (task: CreateCacheTaskParams) => {
    const cacheFilePath = await CountyAndCityTrieFinder.getCacheFilePath(task.diContainer);
    let data: Buffer | undefined;
    let numOfTry: number = 0;
    while (!data && numOfTry < 3) {
      try {
        // TrieFinderが作成できればOK
        if (fs.existsSync(cacheFilePath)) {
          data = await fs.promises.readFile(cacheFilePath);
          const first100bytes = data.subarray(0, 100);
          new CountyAndCityTrieFinder(first100bytes);
          return data;
        }
      } catch (_e: unknown) {
        // Do nothing here
      }

      if (process.env.JEST_WORKER_ID) {
        console.log('Creates catch for CountyAndCityTrieFinder');
      }
      // 新しく作成
      if (!await CountyAndCityTrieFinder.createDictionaryFile(task)) {
        return;
      }
      numOfTry++;
    }
    return data;
  };
}
