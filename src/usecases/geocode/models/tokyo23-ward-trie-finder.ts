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

  static readonly createDictionaryFile = async (diContainer: AbrGeocoderDiContainer) => {
    const cacheFilePath = await Tokyo23WardTrieFinder.getCacheFilePath(diContainer);
    const isExist = fs.existsSync(cacheFilePath);
    if (isExist) {
      return;
    }

    // 古いキャッシュファイルを削除
    await removeFiles({
      dir: diContainer.cacheDir,
      filename: 'tokyo23-ward_.*\\.abrg2',
    });
    
    // キャッシュがなければ、Databaseからデータをロードして読み込む
    // キャッシュファイルも作成する
    const commonDb = await diContainer.database.openCommonDb();
    const rows = await commonDb.getTokyo23Wards();
    const writer = await FileTrieWriter.openFile(cacheFilePath);
    for (const row of rows) {
      await writer.addNode({
        key: Tokyo23WardTrieFinder.normalize(row.key),
        value: row,
      });
    }
    await writer.close();
  };

  static readonly loadDataFile = async (diContainer: AbrGeocoderDiContainer) => {
    const cacheFilePath = await Tokyo23WardTrieFinder.getCacheFilePath(diContainer);
    const isExist = fs.existsSync(cacheFilePath);
    if (!isExist) {
      await Tokyo23WardTrieFinder.createDictionaryFile(diContainer);
    }
    
    try {
      // TrieFinderが作成できればOK
      const data = await fs.promises.readFile(cacheFilePath);
      const first100bytes = data.subarray(0, 100);
      new Tokyo23WardTrieFinder(first100bytes);
      return data;
    } catch (_e: unknown) {
      // エラーが発生する場合は、再作成する
      await fs.promises.unlink(cacheFilePath);
      await Tokyo23WardTrieFinder.createDictionaryFile(diContainer);
      const data = await fs.promises.readFile(cacheFilePath);
      return data;
    }
  };
}
