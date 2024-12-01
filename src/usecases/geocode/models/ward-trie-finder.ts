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

  static readonly createDictionaryFile = async (diContainer: AbrGeocoderDiContainer) => {
    const cacheFilePath = await WardTrieFinder.getCacheFilePath(diContainer);
    const isExist = fs.existsSync(cacheFilePath);
    if (isExist) {
      return;
    }

    // 古いキャッシュファイルを削除
    await removeFiles({
      dir: diContainer.cacheDir,
      filename: 'ward_.*\\.abrg2',
    });
    
    // キャッシュがなければ、Databaseからデータをロードして読み込む
    // キャッシュファイルも作成する
    const commonDb = await diContainer.database.openCommonDb();
    const rows = await commonDb.getWards();
    const writer = await FileTrieWriter.openFile(cacheFilePath);
    for (const row of rows) {
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
    await writer.close();
  };

  static readonly loadDataFile = async (diContainer: AbrGeocoderDiContainer) => {
    const cacheFilePath = await WardTrieFinder.getCacheFilePath(diContainer);
    const isExist = fs.existsSync(cacheFilePath);
    if (!isExist) {
      await WardTrieFinder.createDictionaryFile(diContainer);
    }
    
    try {
      // TrieFinderが作成できればOK
      const data = await fs.promises.readFile(cacheFilePath);
      const first100bytes = data.subarray(0, 100);
      new WardTrieFinder(first100bytes);
      return data;
    } catch (_e: unknown) {
      // エラーが発生する場合は、再作成する
      await fs.promises.unlink(cacheFilePath);
      await WardTrieFinder.createDictionaryFile(diContainer);
      const data = await fs.promises.readFile(cacheFilePath);
      return data;
    }
  };
}
