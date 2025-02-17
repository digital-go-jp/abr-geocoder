import { removeFiles } from "@domain/services/remove-files";
import path from 'node:path';
import { AbrGeocoderDiContainer } from "../abr-geocoder-di-container";
import { CharNode } from "../trie/char-node";
import { WardTrieFinder } from "../ward-trie-finder";

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
    filename: 'ward_.*\\.abrg2',
  });
  await WardTrieFinder.createDictionaryFile(container);

  const finder = await WardTrieFinder.createTrieFinder(container);
  const dbCtrl = await container.database.openCommonDb();
  const rows = await dbCtrl.getWards();
  rows.forEach(row => {
    let result = finder.find({
      target: CharNode.create(WardTrieFinder.normalize(row.key)),
    });
    if (result.length === 0) {
      console.log(row.key, result);
    }
    result = finder.find({
      target: CharNode.create(WardTrieFinder.normalize(row.ward)),
    });
    if (result.length === 0) {
      console.log(row.ward, result);
    }
  });

})();
