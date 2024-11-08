import { DASH, SPACE } from "@config/constant-values";
import { makeDirIfNotExists } from "@domain/services/make-dir-if-not-exists";
import { RegExpEx } from "@domain/services/reg-exp-ex";
import { KoazaMachingInfo } from "@domain/types/geocode/koaza-info";
import fs from 'node:fs';
import path from 'node:path';
import { jisKanji } from '../services/jis-kanji';
import { kan2num } from '../services/kan2num';
import { toHankakuAlphaNum } from "../services/to-hankaku-alpha-num";
import { toHiragana } from '../services/to-hiragana';
import { AbrGeocoderDiContainer } from './abr-geocoder-di-container';
import { TrieAddressFinder } from "./trie/trie-finder";
import { MatchLevel } from "@domain/types/geocode/match-level";
import { removeFiles } from "@domain/services/remove-files";

export class KyotoStreetTrieFinder extends TrieAddressFinder<KoazaMachingInfo> {

  private constructor() {
    super();
  }

  private static normalizeStr(address: string): string {
    // 漢数字を半角数字に変換する
    address = kan2num(address);

    // 全角英数字は、半角英数字に変換
    address = toHankakuAlphaNum(address);
    
    // 片仮名は平仮名に変換する
    address = toHiragana(address);

    // JIS 第2水準 => 第1水準 及び 旧字体 => 新字体
    address = jisKanji(address);

    // input =「丸の内一の八」のように「ハイフン」を「の」で表現する場合があるので
    // 「の」は全部DASHに変換する
    address = address?.replaceAll(RegExpEx.create('([0-9])の', 'g'), `$1${DASH}`);
    
    address = address?.replaceAll(RegExpEx.create('([0-9])の([0-9])', 'g'), `$1${DASH}$2`);

    // 「1丁目下る」の「丁目」を省略して書く事があるので、丁目が入っていなかったら DASHを挿入
    // address = address?.replaceAll(RegExpEx.create(`([0-9]+)(?:丁目|${DASH})?(上る|下る|東入|西入)`, 'g'), `$1${DASH}$2`);

    // // 「丁目」を DASHにする
    address = address?.replaceAll(RegExpEx.create('丁目', 'g'), DASH);

    address = address?.
      replaceAll(RegExpEx.create(`^[${SPACE}${DASH}]`, 'g'), '')?.
      replaceAll(RegExpEx.create(`[${SPACE}${DASH}]$`, 'g'), '');

    return address;
  }

  static readonly create = async (diContainer: AbrGeocoderDiContainer) => {
    makeDirIfNotExists(diContainer.cacheDir);

    const commonDb = await diContainer.database.openCommonDb();
    const genHash = commonDb.getKyotoStreetGeneratorHash();

    const tree = new KyotoStreetTrieFinder();
    const cacheFilePath = path.join(diContainer.cacheDir, `kyoto-street_${genHash}.v8`);
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
      filename: 'kyoto-street_.*\\.v8',
    });
    
    // キャッシュがなければ、Databaseからデータをロードして読み込む
    // キャッシュファイルも作成する
    const rows = await commonDb.getKyotoStreetRows();

    for (const row of rows) {
      row.oaza_cho = toHankakuAlphaNum(row.oaza_cho);
      row.chome = toHankakuAlphaNum(row.chome);
      switch (row.match_level) {
        case MatchLevel.MACHIAZA: {
          // 通り名がヒットしない場合、大字だけで検索を行う
          tree.append({
            key: KyotoStreetTrieFinder.normalizeStr(row.oaza_cho),
            value: row,
          });
          break;
        }

        case MatchLevel.MACHIAZA_DETAIL: {
          row.koaza = toHankakuAlphaNum(row.koaza);
          if (row.koaza_aka_code === 2) {
            // (通り名)+(大字)
            tree.append({
              key: KyotoStreetTrieFinder.normalizeStr(row.koaza + row.oaza_cho),
              value: row,
            });
          } else {
            // (大字)+(丁目)
            const key = KyotoStreetTrieFinder.normalizeStr(row.oaza_cho + row.chome);
            tree.append({
              key,
              value: row,
            });
          }
  
          break;
        }

        default:
          // Do nothing here
          break;
      }
    }

    // キャッシュファイルに保存
    const encoded = tree.export();
    await fs.promises.writeFile(cacheFilePath, encoded);

    return tree;
  };
}
