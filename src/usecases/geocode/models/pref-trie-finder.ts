import { makeDirIfNotExists } from "@domain/services/make-dir-if-not-exists";
import { PrefInfo } from "@domain/types/geocode/pref-info";
import fs from 'node:fs';
import path from 'node:path';
import { jisKanji } from '../services/jis-kanji';
import { kan2num } from '../services/kan2num';
import { toHiragana } from '../services/to-hiragana';
import { AbrGeocoderDiContainer } from './abr-geocoder-di-container';
import { TrieAddressFinder } from "./trie/trie-finder";
import { removeFiles } from "@domain/services/remove-files";

export class PrefTrieFinder extends TrieAddressFinder<PrefInfo> {

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
    makeDirIfNotExists(diContainer.cacheDir);

    const commonDb = await diContainer.database.openCommonDb();
    const genHash = commonDb.getPrefListGeneratorHash();

    const tree = new PrefTrieFinder();
    const cacheFilePath = path.join(diContainer.cacheDir, `pref_${genHash}.abrg`);
    const isExist = fs.existsSync(cacheFilePath);
    try {
      if (isExist) {
        // キャッシュがあれば、キャッシュから読み込む
        const encoded = await fs.promises.readFile(cacheFilePath);
        tree.import(encoded);
        return tree;
      }
    } catch (_e: unknown) {
      // インポートエラーが発生した場合は、キャッシュを作り直すので、
      // ここではエラーを殺すだけで良い
    }

    // 古いキャッシュファイルを削除
    await removeFiles({
      dir: diContainer.cacheDir,
      filename: 'pref_.*\\.v8',
    });
    
    // キャッシュがなければ、Databaseからデータをロードして読み込む
    // キャッシュファイルも作成する
    const prefList = await commonDb.getPrefList();
    for (const prefInfo of prefList) {
      tree.append({
        key: PrefTrieFinder.normalizeStr(prefInfo.pref),
        value: prefInfo,
      });
    }
    const encoded = tree.export();
    await fs.promises.writeFile(cacheFilePath, encoded);

    return tree;
  };
}
