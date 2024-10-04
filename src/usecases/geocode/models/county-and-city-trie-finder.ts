import { makeDirIfNotExists } from "@domain/services/make-dir-if-not-exists";
import { getPackageInfo } from "@domain/services/package/get-package-info";
import { CityMatchingInfo } from "@domain/types/geocode/city-info";
import fs from 'node:fs';
import path from 'node:path';
import { deserialize, serialize } from "node:v8";
import { jisKanji } from '../services/jis-kanji';
import { kan2num } from '../services/kan2num';
import { toHiragana } from '../services/to-hiragana';
import { AbrGeocoderDiContainer } from './abr-geocoder-di-container';
import { TrieAddressFinder } from "./trie/trie-finder";

export class CountyAndCityTrieFinder extends TrieAddressFinder<CityMatchingInfo> {

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
    const { version } = getPackageInfo();
    const cacheDir = path.join(diContainer.cacheDir, version);
    makeDirIfNotExists(cacheDir);

    const tree = new CountyAndCityTrieFinder();
    const cacheFilePath = path.join(cacheDir, 'county-and-city.v8');
    const isExist = fs.existsSync(cacheFilePath);
    if (isExist) {
      // キャッシュがあれば、キャッシュから読み込む
      const encoded = await fs.promises.readFile(cacheFilePath);
      const treeNodes = deserialize(encoded);
      tree.root = treeNodes;
      return tree;
    }

    // キャッシュがなければ、Databaseからデータをロードして読み込む
    // キャッシュファイルも作成する
    const commonDb = await diContainer.database.openCommonDb();
    const rows = await commonDb.getCountyAndCityList();

    for (const row of rows) {
      tree.append({
        key: CountyAndCityTrieFinder.normalizeStr(row.key),
        value: row,
      });
    }

    // キャッシュファイルに保存
    const encoded = serialize(tree.root);
    await fs.promises.writeFile(cacheFilePath, encoded);

    return tree;
  }
}
