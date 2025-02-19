import { makeDirIfNotExists } from "@domain/services/make-dir-if-not-exists";
import { removeFiles } from "@domain/services/remove-files";
import { WardAndOazaMatchingInfo } from "@domain/types/geocode/ward-oaza-info";
import fs from 'node:fs';
import path from 'node:path';
import { jisKanji } from '../services/jis-kanji';
import { kan2num } from '../services/kan2num';
import { toHiragana } from '../services/to-hiragana';
import { AbrGeocoderDiContainer } from './abr-geocoder-di-container';
import { TrieAddressFinder2 } from "./trie/trie-finder2";
import { FileTrieWriter } from "./trie/file-trie-writer";

export class WardAndOazaTrieFinder extends TrieAddressFinder2<WardAndOazaMatchingInfo> {

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
    const genHash = commonDb.getWardAndOazaChoListGeneratorHash();

    return path.join(diContainer.cacheDir, `ward-and-oaza_${genHash}.abrg2`);
  };

  static readonly createDictionaryFile = async (diContainer: AbrGeocoderDiContainer) => {
    const cacheFilePath = await WardAndOazaTrieFinder.getCacheFilePath(diContainer);
    const isExist = fs.existsSync(cacheFilePath);
    if (isExist) {
      return;
    }

    // 古いキャッシュファイルを削除
    await removeFiles({
      dir: diContainer.cacheDir,
      filename: 'ward-and-oaza_.*\\.abrg2',
    });
    
    // キャッシュがなければ、Databaseからデータをロードして読み込む
    // キャッシュファイルも作成する
    const db = await diContainer.database.openCommonDb();
    const rows = await db.getWardAndOazaChoList();
    const writer = await FileTrieWriter.create(cacheFilePath);
    let i = 0;
    while (i < rows.length) {
      const row = rows[i++];
      await writer.addNode({
        key: WardAndOazaTrieFinder.normalize(row.key),
        value: row,
      });
    }
    await writer.close();
    await db.close();
  };

  static readonly loadDataFile = async (diContainer: AbrGeocoderDiContainer) => {
    const cacheFilePath = await WardAndOazaTrieFinder.getCacheFilePath(diContainer);
    const isExist = fs.existsSync(cacheFilePath);
    if (!isExist) {
      await WardAndOazaTrieFinder.createDictionaryFile(diContainer);
    }
    
    try {
      // TrieFinderが作成できればOK
      const data = await fs.promises.readFile(cacheFilePath);
      const first100bytes = data.subarray(0, 100);
      new WardAndOazaTrieFinder(first100bytes);
      return data;
    } catch (_e: unknown) {
      // エラーが発生する場合は、再作成する
      await fs.promises.unlink(cacheFilePath);
      await WardAndOazaTrieFinder.createDictionaryFile(diContainer);
      const data = await fs.promises.readFile(cacheFilePath);
      return data;
    }
  };
}
