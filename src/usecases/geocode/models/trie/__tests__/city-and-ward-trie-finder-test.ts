import { removeFiles } from "@domain/services/remove-files";
import path from 'node:path';
import { AbrGeocoderDiContainer } from "../../abr-geocoder-di-container";
import { CityAndWardTrieFinder } from "../../city-and-ward-trie-finder";
import { CharNode } from "../char-node";

(async () => {
  // const rootDir = path.normalize(path.join(__dirname, '..', '..', '..', '..', '..', 'db'));
  const rootDir = '/Users/maskatsum/.abr-geocoder'

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
    filename: 'city-and-ward_.*\\.abrg2',
  });
  await CityAndWardTrieFinder.createDictionaryFile({
    diContainer: container,
    data: 'city-and-ward',
    isSilentMode: true,
  });

  const data = await CityAndWardTrieFinder.loadDataFile({
    diContainer: container,
    data: 'city-and-ward',
    isSilentMode: true,
  });
  if (!data) {
    throw `Can not read data`;
  }
  const finder = new CityAndWardTrieFinder(data);
  // const dbCtrl = await container.database.openCommonDb();
  // const rows = await dbCtrl.getCityAndWardList();
  const rows = [{
    key: "足利市島田町105-1",
  }];
  rows.forEach(row => {
    const result = finder.find({
      target: CharNode.create(CityAndWardTrieFinder.normalize(row.key)),
    });
    console.log(row.key, result);
  });

})();
