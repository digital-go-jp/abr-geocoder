import { removeFiles } from "@domain/services/remove-files";
import path from 'node:path';
import { AbrGeocoderDiContainer } from "../abr-geocoder-di-container";
import { CityAndWardTrieFinder } from "../city-and-ward-trie-finder";
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
    filename: 'city-and-ward_.*\\.abrg2',
  });
  await CityAndWardTrieFinder.createDictionaryFile(container);

  const finder = await CityAndWardTrieFinder.createTrieFinder(container);
  const dbCtrl = await container.database.openCommonDb();
  const rows = await dbCtrl.getCityAndWardList();
  rows.forEach(row => {
    const result = finder.find({
      target: CharNode.create(CityAndWardTrieFinder.normalize(row.key)),
    });
    if (result.length === 0) {
      console.log(row.key, result);
    }
  });

})();
