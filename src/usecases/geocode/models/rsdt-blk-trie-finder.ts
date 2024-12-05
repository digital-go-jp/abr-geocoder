import { makeDirIfNotExists } from "@domain/services/make-dir-if-not-exists";
import { removeFiles } from "@domain/services/remove-files";
import { RsdtBlkInfo } from "@domain/types/geocode/rsdt-blk-info";
import fs from 'node:fs';
import path from 'node:path';
import { AbrGeocoderDiContainer } from './abr-geocoder-di-container';
import { FileTrieWriter } from "./trie/file-trie-writer";
import { TrieAddressFinder2 } from "./trie/trie-finder2";
import { SemaphoreManager } from "@domain/services/thread/semaphore-manager";

export class RsdtBlkTrieFinder extends TrieAddressFinder2<RsdtBlkInfo> {

  private static readonly semaphore: SemaphoreManager = new SemaphoreManager(new SharedArrayBuffer(4 * 11));

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

    return path.join(diContainer.cacheDir, `rsdtblk_${lg_code}_${genHash}.abrg2`);
  };

  static readonly createDictionaryFile = async ({
    diContainer,
    lg_code,
  } : {
    diContainer: AbrGeocoderDiContainer;
    lg_code: string;
  }) => {
    const cacheFilePath = await RsdtBlkTrieFinder.getCacheFilePath({
      diContainer,
      lg_code,
    });

    // 古いキャッシュファイルを削除
    await removeFiles({
      dir: diContainer.cacheDir,
      filename: `rsdtblk_${lg_code}.*\\.abrg2`,
    });
    
    // キャッシュがなければ、Databaseからデータをロードして読み込む
    // キャッシュファイルも作成する
    const db = await diContainer.database.openRsdtBlkDb({
      lg_code: lg_code,
      createIfNotExists: false,
    });
    if (!db) {
      return false;
    }

    const rows = await db.getBlockNumRows();

    // 同時書き込みの防止
    const lockIdx = parseInt(lg_code) % 11;
    await RsdtBlkTrieFinder.semaphore.enterAwait(lockIdx);

    const writer = await FileTrieWriter.openFile(cacheFilePath);
    for (const row of rows) {
      const key = [
        row.town_key,
        row.blk_num
      ].join(':');

      await writer.addNode({
        key,
        value: {
          rsdtblk_key: row.rsdtblk_key,
          town_key: row.town_key,
          blk_id: row.blk_id,
          blk_num: row.blk_num,
          rep_lat: row.rep_lat,
          rep_lon: row.rep_lon,
        },
      });
    }
    await writer.close();

    // セマフォの解除
    RsdtBlkTrieFinder.semaphore.leave(lockIdx);

    return true;
  };
  
  static readonly loadDataFile = async (params: {
    diContainer: AbrGeocoderDiContainer;
    lg_code: string;
  }) => {
    const cacheFilePath = await RsdtBlkTrieFinder.getCacheFilePath(params);
    let data: Buffer | undefined;
    let numOfTry: number = 0;
    while (!data && numOfTry < 3) {
      try {
        // TrieFinderが作成できればOK
        if (fs.existsSync(cacheFilePath)) {
          data = await fs.promises.readFile(cacheFilePath);
          const first100bytes = data.subarray(0, 100);
          new RsdtBlkTrieFinder(first100bytes);
          return data;
        }
      } catch (_e: unknown) {
        // Do nothing here
      }

      // 新しく作成
      if (!await RsdtBlkTrieFinder.createDictionaryFile(params)) {
        return;
      }
      console.log(`creating cache for rsdtblk:${params.lg_code}`);
      numOfTry++;
    }
    return data;
  };
}
