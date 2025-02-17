import { removeFiles } from "@domain/services/remove-files";
import path from 'node:path';
import { AbrGeocoderDiContainer } from "../abr-geocoder-di-container";
import { Tokyo23TownTrieFinder } from "../tokyo23-town-finder";
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
    filename: 'tokyo23-town_.*\\.abrg2',
  });
  await Tokyo23TownTrieFinder.createDictionaryFile(container);

  const finder = await Tokyo23TownTrieFinder.createTrieFinder(container);
  const dbCtrl = await container.database.openCommonDb();
  const rows = await dbCtrl.getTokyo23Towns();
  rows.forEach(row => {
    const result = finder.find({
      target: CharNode.create(Tokyo23TownTrieFinder.normalize(row.key)),
    });
    if (result.length === 0) {
      console.log(row.key, result);
    }
  });

})();
