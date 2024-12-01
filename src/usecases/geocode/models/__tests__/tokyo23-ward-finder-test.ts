import { removeFiles } from "@domain/services/remove-files";
import path from 'node:path';
import { AbrGeocoderDiContainer } from "../abr-geocoder-di-container";
import { CharNode } from "../trie/char-node";
import { Tokyo23WardTrieFinder } from "../tokyo23-ward-trie-finder";

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
    filename: 'tokyo23-ward.*\\.abrg2',
  });
  await Tokyo23WardTrieFinder.createDictionaryFile(container);

  const finder = await Tokyo23WardTrieFinder.createTrieFinder(container);
  const dbCtrl = await container.database.openCommonDb();
  const rows = await dbCtrl.getTokyo23Wards();
  rows.forEach(row => {
    const result = finder.find({
      target: CharNode.create(Tokyo23WardTrieFinder.normalize(row.key)),
    });
    if (result.length === 0) {
      console.log(row.key, result);
    }
  });

})();
