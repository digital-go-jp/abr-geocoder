import { BANGAICHI, DASH, MUBANCHI, OAZA_BANCHO, SPACE } from "@config/constant-values";
import { makeDirIfNotExists } from "@domain/services/make-dir-if-not-exists";
import { RegExpEx } from "@domain/services/reg-exp-ex";
import { OazaChoMachingInfo } from "@domain/types/geocode/oaza-cho-info";
import fs from 'node:fs';
import path from 'node:path';
import { jisKanji } from '../services/jis-kanji';
import { kan2num } from '../services/kan2num';
import { toHankakuAlphaNum } from "../services/to-hankaku-alpha-num";
import { toHiragana } from '../services/to-hiragana';
import { AbrGeocoderDiContainer } from './abr-geocoder-di-container';
import { CharNode } from "./trie/char-node";
import { TrieAddressFinder } from "./trie/trie-finder";
import { removeFiles } from "@domain/services/remove-files";

export class OazaChoTrieFinder extends TrieAddressFinder<OazaChoMachingInfo> {

  private constructor() {
    super();
  }

  static normalize<T extends string | CharNode | undefined>(address: T): T {
    if (address === undefined) {
      return undefined as T;
    }
    // 全角英数字は、半角英数字に変換
    address = toHankakuAlphaNum(address);

    // 片仮名は平仮名に変換する
    address = toHiragana(address);
    
    // JIS 第2水準 => 第1水準 及び 旧字体 => 新字体
    address = jisKanji(address);

    // 漢数字を半角数字に変換する
    address = kan2num(address);

    // 「無番地」を「MUBANCHI」にする
    address = address?.replace(RegExpEx.create('無番地'), MUBANCHI) as T;
    
    // 「番外地」を「BANGAICHI」にする
    address = address?.replace(RegExpEx.create('番外地'), BANGAICHI) as T;
    
    // 大字が「番町」の場合があるので、置換する
    address = address?.replace(RegExpEx.create('番町', 'g'), OAZA_BANCHO) as T;

    // 「番地」「番丁」「番街」「番」「番地の」をDASHにする
    address = address?.replace(RegExpEx.create('番[丁地街]'), DASH) as T;
    address = address?.replace(RegExpEx.create('番[の目]'), DASH) as T;

    // 「大字」「字」がある場合は削除する
    address = address?.replaceAll(RegExpEx.create('大?字', 'g'), '') as T;
    
    // 「丁目」をDASH に変換する
    // 大阪府堺市は「丁目」の「目」が付かないので「目?」としている
    address = address?.replaceAll(RegExpEx.create('丁目?', 'g'), DASH) as T;
    
    // 京都の「四条通」の「通」が省略されることがある
    // 北海道では「春光四条二丁目1-1」を「春光4-2-1-1」と表記する例がある
    // 「条」「条通」「条通り」を DASH にする
    address = address?.replace(RegExpEx.create(`([0-9]+)(?:条|条通|条通り)`, 'g'), `$1${DASH}`) as T;

    // 第1地割 → 1地割 と書くこともあるので、「1(DASH)」にする
    // 第1地区、1丁目、1号、1部、1番地、第1なども同様。
    // トライ木でマッチすれば良いだけなので、正確である必要性はない
    address = address?.replaceAll(RegExpEx.create(`第?([0-9]+)(?:地[割区]|番[地丁]?|軒|号|線|部|条通?|字|${DASH})(?![室棟区館階])`, 'g'), `$1${DASH}`) as T;

    // 北海道に「太田五の通り」という大字がある。DASHにする
    address = address?.replace(RegExpEx.create('の通り?'), DASH) as T;
    address = address?.replace(RegExpEx.create('通り'), DASH) as T;

    // 「〇〇町」の「町」が省略されることがあるので、、削除しておく → どうもこれ、うまく機能しない。別の方法を考える
    // address = address.replace(RegExpEx.create('(.{2,})町'), '$1');

    // input =「丸の内一の八」のように「ハイフン」を「の」で表現する場合があるので
    // 「の」は全部DASHに変換する
    address = address?.replaceAll(RegExpEx.create('([0-9])の([0-9])', 'g'), `$1${DASH}$2`) as T;
    address = address?.replaceAll(RegExpEx.create('之', 'g'), DASH) as T;

    address = address?.replace(RegExpEx.create(`${DASH}+$`), '') as T;
    
    address = address?.
      replaceAll(RegExpEx.create(`^[${SPACE}${DASH}]`, 'g'), '')?.
      replaceAll(RegExpEx.create(`[${SPACE}${DASH}]$`, 'g'), '') as T;

    return address;
  }

  static readonly create = async (diContainer: AbrGeocoderDiContainer) => {
    makeDirIfNotExists(diContainer.cacheDir);

    const commonDb = await diContainer.database.openCommonDb();
    const genHash = commonDb.getOazaChomesGeneratorHash();

    const tree = new OazaChoTrieFinder();
    const cacheFilePath = path.join(diContainer.cacheDir, `oaza-cho_${genHash}.v8`);
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
      filename: 'oaza-cho_.*\\.v8',
    });

    // キャッシュがなければ、Databaseからデータをロードして読み込む
    // キャッシュファイルも作成する
    const rows = await commonDb.getOazaChomes();

    for (const oazaInfo of rows) {
      oazaInfo.oaza_cho = toHankakuAlphaNum(oazaInfo.oaza_cho);
      oazaInfo.chome = toHankakuAlphaNum(oazaInfo.chome);
      oazaInfo.koaza = toHankakuAlphaNum(oazaInfo.koaza);
      const key = OazaChoTrieFinder.normalize(oazaInfo.key);
      tree.append({
        key,
        value: oazaInfo,
      });
    }

    // キャッシュファイルに保存
    const encoded = tree.export();
    await fs.promises.writeFile(cacheFilePath, encoded);

    return tree;
  };
}
