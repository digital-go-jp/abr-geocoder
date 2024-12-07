import { removeFiles } from "@domain/services/remove-files";
import path from 'node:path';
import { AbrGeocoderDiContainer } from "../abr-geocoder-di-container";
import { RsdtBlkTrieFinder } from "../rsdt-blk-trie-finder";
import { CharNode } from "../trie/char-node";

(async () => {
  const rootDir = path.normalize(path.join(__dirname, '..', '..', '..', '..', '..'));
  const lg_code = '011011';

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
    filename: `rsdtblk_${lg_code}_.*\\.abrg2`,
  });
  await RsdtBlkTrieFinder.createDictionaryFile({
    diContainer: container,
    lg_code,
  });

  const finderData = await RsdtBlkTrieFinder.loadDataFile({
    diContainer: container,
    lg_code,
  });
  if (!finderData) {
    throw `can not load the finder data`;
  }
  const finder = new RsdtBlkTrieFinder(finderData);
  const db = await container.database.openRsdtBlkDb({
    lg_code,
    createIfNotExists: false,
  });
  const rows = await db?.getBlockNumRows();
  rows?.forEach(row => {
    let result = finder.find({
      target: CharNode.create(`${row.town_key}:${row.blk_num}`)!,
      partialMatches: true,
    });
    if (result.length === 0) {
      console.log(`${row.town_key}:${row.blk_num}`, row);
    }
  })

})();
