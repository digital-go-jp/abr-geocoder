import { removeFiles } from "@domain/services/remove-files";
import path from 'node:path';
import { AbrGeocoderDiContainer } from "../abr-geocoder-di-container";
import { ParcelTrieFinder } from "../parcel-trie-finder";
import { CharNode } from "../trie/char-node";

(async () => {
  const lg_code = '261076';
  const rootDir = path.normalize(path.join(__dirname, '..', '..', '..', '..', '..', 'db'));

  const container = new AbrGeocoderDiContainer({
    cacheDir: `${rootDir}/cache`,
    database: {
      type: 'sqlite3',
      dataDir: `${rootDir}/database`,
    },
    debug: true,
  });

  // 古いキャッシュファイルを削除
  await removeFiles({
    dir: container.cacheDir,
    filename: `parcel_${lg_code}_.*\\.abrg2`,
  });
  await ParcelTrieFinder.createDictionaryFile({
    diContainer: container,
    lg_code,
  });

  const finderData = await ParcelTrieFinder.loadDataFile({
    diContainer: container,
    lg_code,
  });
  if (!finderData) {
    throw `can not load the finder data`;
  }
  const finder = new ParcelTrieFinder(finderData);
  const db = await container.database.openParcelDb({
    lg_code,
    createIfNotExists: false,
  });
  const rows = await db?.getParcelRows();
  const PARCEL_LENGTH = 5;
  rows?.forEach(row => {
    const key = row.town_key + ':' + [
      row.prc_num1.toString().padStart(PARCEL_LENGTH, '0'),
      (row.prc_num2 || '').toString().padStart(PARCEL_LENGTH, '0'),
      (row.prc_num3 || '').toString().padStart(PARCEL_LENGTH, '0'),
    ]
      .join('');
    const result = finder.find({
      target: CharNode.create(key)!,
      partialMatches: true,
    });
    if (!result) {
      console.log(`${key}`, row);
    }
  });

})();
