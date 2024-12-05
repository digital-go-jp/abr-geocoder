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

  static readonly createDictionaryFile = async (diContainer: AbrGeocoderDiContainer) => {
    const cacheFilePath = await PrefTrieFinder.getCacheFilePath(diContainer);

    // 古いキャッシュファイルを削除
    await removeFiles({
      dir: diContainer.cacheDir,
      filename: 'pref_.*\\.abrg2',
    });
    // キャッシュがなければ、Databaseからデータをロードして読み込む
    // キャッシュファイルも作成する
    const db = await diContainer.database.openCommonDb();
    if (!db) {
      return false;
    }

    const rows = await db.getPrefList()
    const writer = await FileTrieWriter.openFile(cacheFilePath);
    for (const row of rows) {
      await writer.addNode({
        key: PrefTrieFinder.normalize(row.pref),
        value: row,
      });
    }
    await writer.close();
    return true;
  };

  static readonly loadDataFile = async (diContainer: AbrGeocoderDiContainer) => {
    const cacheFilePath = await PrefTrieFinder.getCacheFilePath(diContainer);
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

      // 新しく作成
      if (!await PrefTrieFinder.createDictionaryFile(diContainer)) {
        return;
      }
      numOfTry++;
    }
    return data;
  };
}
