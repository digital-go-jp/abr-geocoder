import { removeFiles } from "@domain/services/remove-files";
import path from 'node:path';
import { AbrGeocoderDiContainer } from "../abr-geocoder-di-container";
import { CharNode } from "../trie/char-node";
import { WardAndOazaTrieFinder } from "../ward-and-oaza-trie-finder";

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
    filename: 'ward-and-oaza_.*\\.abrg2',
  });
  await WardAndOazaTrieFinder.createDictionaryFile(container);

  const finder = await WardAndOazaTrieFinder.createTrieFinder(container);
  const dbCtrl = await container.database.openCommonDb();
  const rows = await dbCtrl.getWardAndOazaChoList();
  rows.forEach(row => {
    const result = finder.find({
      target: CharNode.create(WardAndOazaTrieFinder.normalize(row.key)),
    });
    if (result.length === 0) {
      console.log(row.key, result);
    }
  });

})();
