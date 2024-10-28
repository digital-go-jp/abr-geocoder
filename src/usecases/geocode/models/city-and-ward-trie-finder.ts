import { makeDirIfNotExists } from "@domain/services/make-dir-if-not-exists";
import { CityMatchingInfo } from "@domain/types/geocode/city-info";
import fs from 'node:fs';
import path from 'node:path';
import { jisKanji } from '../services/jis-kanji';
import { kan2num } from '../services/kan2num';
import { toHiragana } from '../services/to-hiragana';
import { AbrGeocoderDiContainer } from './abr-geocoder-di-container';
import { TrieAddressFinder } from "./trie/trie-finder";

export class CityAndWardTrieFinder extends TrieAddressFinder<CityMatchingInfo> {

  private constructor() {
    super();
  }

  private static normalizeStr(value: string): string {
    // 半角カナ・全角カナ => 平仮名
    value = toHiragana(value);

    // JIS 第2水準 => 第1水準 及び 旧字体 => 新字体
    value = jisKanji(value);

    // 漢数字 => 算用数字
    value = kan2num(value);
    
    return value;
  }

  static readonly create = async (diContainer: AbrGeocoderDiContainer) => {
    const cacheDir = path.join(diContainer.cacheDir);
    makeDirIfNotExists(cacheDir);

    const commonDb = await diContainer.database.openCommonDb();
    const genHash = commonDb.getCityAndWardListGeneratorHash();
    
    const tree = new CityAndWardTrieFinder();
    const cacheFilePath = path.join(cacheDir, `city-and-ward_${genHash}.v8`);
    const isExist = fs.existsSync(cacheFilePath);
    if (isExist) {
      // キャッシュがあれば、キャッシュから読み込む
      const encoded = await fs.promises.readFile(cacheFilePath);
      tree.import(encoded);
      return tree;
    }

    // キャッシュがなければ、Databaseからデータをロードして読み込む
    // キャッシュファイルも作成する
    const rows = await commonDb.getCityAndWardList();

    for (const row of rows) {
      tree.append({
        key: CityAndWardTrieFinder.normalizeStr(row.key),
        value: row,
      });
    }

    // キャッシュファイルに保存
    const encoded = tree.export();
    await fs.promises.writeFile(cacheFilePath, encoded);

    return tree;
  };
}
