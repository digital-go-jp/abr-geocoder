import { BANGAICHI, DASH, DASH_SYMBOLS, MUBANCHI, OAZA_BANCHO, OAZA_CENTER, SPACE } from "@config/constant-values";
import { makeDirIfNotExists } from "@domain/services/make-dir-if-not-exists";
import { RegExpEx } from "@domain/services/reg-exp-ex";
import { removeFiles } from "@domain/services/remove-files";
import fs from 'node:fs';
import path from 'node:path';
import { jisKanji } from '../services/jis-kanji';
import { kan2num } from '../services/kan2num';
import { toHankakuAlphaNum } from "../services/to-hankaku-alpha-num";
import { toHiragana } from '../services/to-hiragana';
import { AbrGeocoderDiContainer } from './abr-geocoder-di-container';
import { CharNode } from "./trie/char-node";
import { TrieAddressFinder2 } from "./trie/trie-finder2";
import { FileTrieWriter } from "./trie/file-trie-writer";
import { createSingleProgressBar } from "@domain/services/progress-bars/create-single-progress-bar";
import { CreateCacheTaskParams } from "../services/worker/create-cache-params";
import { TownMatchingInfo } from "@domain/types/geocode/town-info";

export class OazaChoTrieFinder extends TrieAddressFinder2<TownMatchingInfo> {

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

    // 「センター」を「OAZA_CENTER」に置き換える
    address = address?.replace(RegExpEx.create(`せんた[${DASH_SYMBOLS}]`), OAZA_CENTER) as T;
    
    // 「無番地」を「MUBANCHI」にする
    address = address?.replace(RegExpEx.create('無番地'), MUBANCHI) as T;
    
    // 「番外地」を「BANGAICHI」にする
    address = address?.replace(RegExpEx.create('番外地'), BANGAICHI) as T;
    
    // 大字が「番町」の場合があるので、置換する
    address = address?.replace(RegExpEx.create('([0-9])番町', 'g'), `$1${DASH}`) as T;
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

  private static readonly getCacheFilePath = async (task: CreateCacheTaskParams) => {
    makeDirIfNotExists(task.diContainer.cacheDir);
    const commonDb = await task.diContainer.database.openCommonDb();
    const genHash = commonDb.getOazaChomesGeneratorHash();
    const extension = process.env.JEST_WORKER_ID ? 'debug' : 'abrg2';

    return path.join(task.diContainer.cacheDir, `oaza-cho_${genHash}_${task.data.lg_code}.${extension}`);
  };

  static readonly createDictionaryFile = async (task: CreateCacheTaskParams) => {
    if (!task.data.lg_code) {
      throw `lg_code is required`;
    }
    const cacheFilePath = await OazaChoTrieFinder.getCacheFilePath(task);

    // 古いキャッシュファイルを削除
    if (process.env.JEST_WORKER_ID) {
      await removeFiles({
        dir: task.diContainer.cacheDir,
        filename: `oaza-cho_[^_]+_${task.data.lg_code}$\\.debug`,
      });
    } else {
      await removeFiles({
        dir: task.diContainer.cacheDir,
        filename: `oaza-cho_[^_]+_${task.data.lg_code}$\\.abrg2`,
      });
    }
    
    // キャッシュがなければ、Databaseからデータをロードして読み込む
    // キャッシュファイルも作成する
    const db = await task.diContainer.database.openCommonDb();
    if (!db) {
      return false;
    }
    const rows = await db.getOazaChomes({
      lg_code: task.data.lg_code,
    });
    const writer = await FileTrieWriter.create(cacheFilePath);
    let i = 0;
    const progressBar = createSingleProgressBar(`oaza: {bar} {percentage}% | {value}/{total} | ETA: {eta_formatted}`);
    progressBar?.start(rows.length, 0);
    while (i < rows.length) {
      const row = rows[i++];
      
      row.oaza_cho = toHankakuAlphaNum(row.oaza_cho);
      row.chome = toHankakuAlphaNum(row.chome);
      row.koaza = toHankakuAlphaNum(row.koaza);
      
      await writer.addNode({
        key: OazaChoTrieFinder.normalize([
          row.oaza_cho || '',
          row.chome || '',
          row.koaza || '',
        ].join('')),
        value: row,
      });
      
      let oaza_cho = row.oaza_cho;
      if (oaza_cho && oaza_cho.length > 2) {
        if (oaza_cho.endsWith('番町')) {
          oaza_cho = oaza_cho.replace('番町', '');
        }
        if (oaza_cho.endsWith('町')) {
          oaza_cho = oaza_cho.replace('町', '');
        }

        await writer.addNode({
          key: OazaChoTrieFinder.normalize([
            oaza_cho || '',
            row.chome || '',
            row.koaza || '',
          ].join('')),
          value: row,
        });
      }

      let chome = row.chome;
      if (chome && chome.length > 2) {
        if (chome.endsWith('番町')) {
          chome = chome.replace('番町', '');
        }
        if (chome.endsWith('町')) {
          chome = chome.replace('町', '');
        }

        await writer.addNode({
          key: OazaChoTrieFinder.normalize([
            row.oaza_cho || '',
            chome || '',
            row.koaza || '',
          ].join('')),
          value: row,
        });
      }
      progressBar?.increment();
    }
    progressBar?.stop();
    await writer.close();
    await db.close();
    return true;
  };
  
  static readonly loadDataFile = async (task: CreateCacheTaskParams) => {
    if (!task.data.lg_code) {
      throw `lg_code is required`;
    }
    const cacheFilePath = await OazaChoTrieFinder.getCacheFilePath(task);
    let data: Buffer | undefined;
    let numOfTry: number = 0;
    while (!data && numOfTry < 3) {
      try {
        // TrieFinderが作成できればOK
        if (fs.existsSync(cacheFilePath)) {
          data = await fs.promises.readFile(cacheFilePath);
          const first100bytes = data.subarray(0, 100);
          new OazaChoTrieFinder(first100bytes);
          return data;
        }
      } catch (_e: unknown) {
        // Do nothing here
      }

      if (process.env.JEST_WORKER_ID) {
        console.log('Creates catch for OazaChoTrieFinder');
      }
      // 新しく作成
      if (!await OazaChoTrieFinder.createDictionaryFile(task)) {
        return;
      }
      numOfTry++;
    }
    return data;
  };
}
