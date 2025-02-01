import { makeDirIfNotExists } from "@domain/services/make-dir-if-not-exists";
import { removeFiles } from "@domain/services/remove-files";
import { RsdtDspInfo } from "@domain/types/geocode/rsdt-dsp-info";
import fs from 'node:fs';
import path from 'node:path';
import { AbrGeocoderDiContainer } from './abr-geocoder-di-container';
import { FileTrieWriter } from "./trie/file-trie-writer";
import { TrieAddressFinder2 } from "./trie/trie-finder2";

export class RsdtDspTrieFinder extends TrieAddressFinder2<RsdtDspInfo> {

  private static readonly getCacheFilePath = async ({
    diContainer,
    lg_code,
  } : {
    diContainer: AbrGeocoderDiContainer;
    lg_code: string;
  }) => {
    makeDirIfNotExists(diContainer.cacheDir);
    const commonDb = await diContainer.database.openCommonDb();
    const genHash = commonDb.getOazaChomesGeneratorHash();

    return path.join(diContainer.cacheDir, `rsdtdsp_${lg_code}_${genHash}.abrg2`);
  };

  static readonly createDictionaryFile = async ({
    diContainer,
    lg_code,
  } : {
    diContainer: AbrGeocoderDiContainer;
    lg_code: string;
  }) => {
    const cacheFilePath = await RsdtDspTrieFinder.getCacheFilePath({
      diContainer,
      lg_code,
    });

    // 古いキャッシュファイルを削除
    await removeFiles({
      dir: diContainer.cacheDir,
      filename: `rsdtdsp_${lg_code}.*\\.abrg2`,
    });
    
    // キャッシュがなければ、Databaseからデータをロードして読み込む
    // キャッシュファイルも作成する
    const db = await diContainer.database.openRsdtDspDb({
      lg_code: lg_code,
      createIfNotExists: false,
    });
    if (!db) {
      return false;
    }

    const rows = (await db.getRsdtDspRows());

    const writer = await FileTrieWriter.create(cacheFilePath);
    let i = 0;
    while (i < rows.length) {
      const row = rows[i++];

      const key = [
        row.rsdtblk_key.toString() || '',
        row.rsdt_num || '',
        row.rsdt_num2 || '',
      ]
        .filter(x => x !== '')
        .join(':');
      // if (!allows.has(key)) {
      //   continue;
      // }
      // console.log(key);
      
      await writer.addNode({
        key,
        value: {
          rsdtdsp_key: row.rsdtdsp_key,
          rsdtblk_key: row.rsdtblk_key,
          rsdt_id: row.rsdt_id,
          rsdt2_id: row.rsdt2_id,
          rsdt_num: row.rsdt_num,
          rsdt_num2: row.rsdt_num2,
          rep_lat: row.rep_lat,
          rep_lon: row.rep_lon,
        },
      });
    }
    await writer.close();
    await db.close();
    return true;
  };
  
  static readonly loadDataFile = async (params: {
    diContainer: AbrGeocoderDiContainer;
    lg_code: string;
  }) => {
    const cacheFilePath = await RsdtDspTrieFinder.getCacheFilePath(params);
    let data: Buffer | undefined;
    let numOfTry: number = 0;
    while (!data && numOfTry < 3) {
      try {
        // TrieFinderが作成できればOK
        if (fs.existsSync(cacheFilePath)) {
          data = await fs.promises.readFile(cacheFilePath);
          const first100bytes = data.subarray(0, 100);
          new RsdtDspTrieFinder(first100bytes);
          return data;
        }
      } catch (_e: unknown) {
        // Do nothing here
        console.log(_e);
      }

      // 新しく作成
      if (!await RsdtDspTrieFinder.createDictionaryFile(params)) {
        return;
      }
      numOfTry++;
    }
    return data;
  };
}
