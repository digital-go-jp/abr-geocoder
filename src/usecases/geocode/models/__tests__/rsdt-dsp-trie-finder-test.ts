import { removeFiles } from "@domain/services/remove-files";
import path from 'node:path';
import { AbrGeocoderDiContainer } from "../abr-geocoder-di-container";
import { RsdtDspTrieFinder } from "../rsdt-dsp-trie-finder";
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
    filename: `rsdtdsp_012068_.*\\.abrg2`,
  });
  await RsdtDspTrieFinder.createDictionaryFile({
    diContainer: container,
    lg_code: '012068',
  });

  const finderData = await RsdtDspTrieFinder.loadDataFile({
    diContainer: container,
    lg_code: '012068',
  });
  if (!finderData) {
    throw `can not load the finder data`;
  }
  const finder = new RsdtDspTrieFinder(finderData);
  const db = await container.database.openRsdtDspDb({
    lg_code: '012068',
    createIfNotExists: false,
  });
  const rows = (await db!.getRsdtDspRows());
  rows?.forEach(row => {
    const key = [
      row.rsdtblk_key.toString() || '',
      row.rsdt_num || '',
      row.rsdt_num2 || '',
    ]
      .filter(x => x !== '')
      .join(':');
    const result = finder.find({
      target: CharNode.create(key)!,
    });
    if (result.length === 0) {
      console.log(`${key}`, result);
    }
  });

})();
