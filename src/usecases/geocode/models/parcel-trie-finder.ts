import { makeDirIfNotExists } from "@domain/services/make-dir-if-not-exists";
import { removeFiles } from "@domain/services/remove-files";
import { ParcelInfo } from "@domain/types/geocode/parcel-info";
import fs from 'node:fs';
import path from 'node:path';
import { AbrGeocoderDiContainer } from './abr-geocoder-di-container';
import { FileTrieWriter } from "./trie/file-trie-writer";
import { TrieAddressFinder2 } from "./trie/trie-finder2";

export class ParcelTrieFinder extends TrieAddressFinder2<ParcelInfo> {

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

    return path.join(diContainer.cacheDir, `parcel_${lg_code}_${genHash}.abrg2`);
  };

  static readonly createDictionaryFile = async ({
    diContainer,
    lg_code,
  } : {
    diContainer: AbrGeocoderDiContainer;
    lg_code: string;
  }) => {
    const cacheFilePath = await ParcelTrieFinder.getCacheFilePath({
      diContainer,
      lg_code,
    });
    
    // 古いキャッシュファイルを削除
    await removeFiles({
      dir: diContainer.cacheDir,
      filename: `parcel_${lg_code}.*\\.abrg2`,
    });

    // キャッシュがなければ、Databaseからデータをロードして読み込む
    // キャッシュファイルも作成する
    const db = await diContainer.database.openParcelDb({
      lg_code: lg_code,
      createIfNotExists: false,
    });
    if (!db) {
      return false;
    }

    const rows = await db.getParcelRows();

    const writer = await FileTrieWriter.create(cacheFilePath);
    const PARCEL_LENGTH = 5;
    let i = 0;
    while (i < rows.length) {
      const row = rows[i++];
      const key = row.town_key + ':' + [
        row.prc_num1.toString().padStart(PARCEL_LENGTH, '0'),
        (row.prc_num2 || '').toString().padStart(PARCEL_LENGTH, '0'),
        (row.prc_num3 || '').toString().padStart(PARCEL_LENGTH, '0'),
      ]
      .join('');

      await writer.addNode({
        key,
        value: {
          rsdtdsp_key: row.parcel_key,
          town_key: row.town_key,
          prc_id: row.prc_id,
          prc_num1: row.prc_num1,
          prc_num2: row.prc_num2,
          prc_num3: row.prc_num3,
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
    const cacheFilePath = await ParcelTrieFinder.getCacheFilePath(params);
    let data: Buffer | undefined;
    let numOfTry: number = 0;
    while (!data && numOfTry < 3) {
      try {
        // TrieFinderが作成できればOK
        if (fs.existsSync(cacheFilePath)) {
          data = await fs.promises.readFile(cacheFilePath);
          const first100bytes = data.subarray(0, 100);
          new ParcelTrieFinder(first100bytes);
          return data;
        }
      } catch (_e: unknown) {
        console.log(_e);
        // Do nothing here
      }

      // 新しく作成
      if (!await ParcelTrieFinder.createDictionaryFile(params)) {
        return;
      }
      numOfTry++;
    }
    return data;
  };
}
