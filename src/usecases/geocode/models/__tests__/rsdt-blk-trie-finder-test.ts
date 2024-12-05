import { removeFiles } from "@domain/services/remove-files";
import path from 'node:path';
import { AbrGeocoderDiContainer } from "../abr-geocoder-di-container";
import { RsdtBlkTrieFinder } from "../rsdt-blk-trie-finder";
import { CharNode } from "../trie/char-node";

(async () => {
  const rootDir = path.normalize(path.join(__dirname, '..', '..', '..', '..', '..'));

  const container = new AbrGeocoderDiContainer({
    cacheDir: `${rootDir}/db/cache`,
    database: {
      type: 'sqlite3',
      dataDir: `${rootDir}/db/database`,
    },
    debug: true,
  });

  // 古いキャッシュファイルを削除
  await removeFiles({
    dir: container.cacheDir,
    filename: `rsdtblk_012068_.*\\.abrg2`,
  });
  await RsdtBlkTrieFinder.createDictionaryFile({
    diContainer: container,
    lg_code: '012068'
  });

  const finderData = await RsdtBlkTrieFinder.loadDataFile({
    diContainer: container,
    lg_code: '012068'
  });
  if (!finderData) {
    throw `can not load the finder data`;
  }
  const finder = new RsdtBlkTrieFinder(finderData);
  const db = await container.database.openRsdtBlkDb({
    lg_code: '012068',
    createIfNotExists: false,
  });
  const rows = await db?.getBlockNumRows();
  rows?.forEach(row => {
    let result = finder.find({
      target: CharNode.create(`${row.town_key}:${row.blk_num}`)!,
      partialMatches: true,
    });
    if (!result) {
      console.log(`${row.town_key}:${row.blk_num}`, row);
    }
  })

})();
