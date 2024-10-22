import { makeDirIfNotExists } from "@domain/services/make-dir-if-not-exists";
import { WardMatchingInfo } from "@domain/types/geocode/ward-info";
import fs from 'node:fs';
import path from 'node:path';
import { deserialize, serialize } from "node:v8";
import { jisKanji } from '../services/jis-kanji';
import { toHankakuAlphaNum } from "../services/to-hankaku-alpha-num";
import { toHiragana } from '../services/to-hiragana';
import { AbrGeocoderDiContainer } from './abr-geocoder-di-container';
import { TrieAddressFinder } from "./trie/trie-finder";

export class WardTrieFinder extends TrieAddressFinder<WardMatchingInfo> {

  private constructor() {
    super();
  }

  static readonly normalizeStr = (address: string): string => {
    // 漢数字を半角英数字にする
    address = toHankakuAlphaNum(address);

    // JIS 第2水準 => 第1水準 及び 旧字体 => 新字体
    address = jisKanji(address);

    // カタカナは全てひらがなにする（南アルプス市）
    address = toHiragana(address);
    return address;
  };

  static readonly create = async (diContainer: AbrGeocoderDiContainer) => {
    makeDirIfNotExists(diContainer.cacheDir);

    const commonDb = await diContainer.database.openCommonDb();
    const genHash = commonDb.getPrefListGeneratorHash();

    const tree = new WardTrieFinder();
    const cacheFilePath = path.join(diContainer.cacheDir, `ward_${genHash}.v8`);
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
    const rows = await commonDb.getWards();

    for (const row of rows) {
      tree.append({
        key: WardTrieFinder.normalizeStr(row.key),
        value: row,
      });
      // partial match させるために、〇〇区だけでも登録する
      tree.append({
        key: WardTrieFinder.normalizeStr(row.ward),
        value: row,
      });
    }

    // キャッシュファイルに保存
    const encoded = serialize(tree.root);
    await fs.promises.writeFile(cacheFilePath, encoded);

    return tree;
  };
}
