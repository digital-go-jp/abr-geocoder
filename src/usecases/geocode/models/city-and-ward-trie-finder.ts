import { makeDirIfNotExists } from "@domain/services/make-dir-if-not-exists";
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

export class CityAndWardTrieFinder extends TrieAddressFinder2<CityMatchingInfo> {

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
    const genHash = commonDb.getCityAndWardListGeneratorHash();

    return path.join(diContainer.cacheDir, `city-and-ward_${genHash}.abrg2`);
  };

  static readonly createDictionaryFile = async (diContainer: AbrGeocoderDiContainer) => {
    const cacheFilePath = await CityAndWardTrieFinder.getCacheFilePath(diContainer);
    const isExist = fs.existsSync(cacheFilePath);
    if (isExist) {
      return;
    }

    // 古いキャッシュファイルを削除
    await removeFiles({
      dir: diContainer.cacheDir,
      filename: 'city-and-ward_.*\\.abrg2',
    });
    
    // キャッシュがなければ、Databaseからデータをロードして読み込む
    // キャッシュファイルも作成する
    const commonDb = await diContainer.database.openCommonDb();
    const rows = await commonDb.getCityAndWardList();
    const writer = await FileTrieWriter.openFile(cacheFilePath);
    for (const row of rows) {
      await writer.addNode({
        key: CityAndWardTrieFinder.normalize(row.key),
        value: row,
      });
    }
    await writer.close();
  };
  
  static readonly loadDataFile = async (diContainer: AbrGeocoderDiContainer) => {
    const cacheFilePath = await CityAndWardTrieFinder.getCacheFilePath(diContainer);
    const isExist = fs.existsSync(cacheFilePath);
    if (!isExist) {
      await CityAndWardTrieFinder.createDictionaryFile(diContainer);
    }
    
    try {
      // TrieFinderが作成できればOK
      const data = await fs.promises.readFile(cacheFilePath);
      const first100bytes = data.subarray(0, 100);
      new CityAndWardTrieFinder(first100bytes);
      return data;
    } catch (_e: unknown) {
      // エラーが発生する場合は、再作成する
      await fs.promises.unlink(cacheFilePath);
      await CityAndWardTrieFinder.createDictionaryFile(diContainer);
      const data = await fs.promises.readFile(cacheFilePath);
      return data;
    }
  };
}
