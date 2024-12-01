import path from 'node:path';
import { AbrGeocoderDiContainer } from "../abr-geocoder-di-container";
import { CountyAndCityTrieFinder } from "../county-and-city-trie-finder";
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
  // await removeFiles({
  //   dir: container.cacheDir,
  //   filename: 'county-and-city_.*\\.abrg2',
  // });
  await CountyAndCityTrieFinder.createDictionaryFile(container);

  const finder = await CountyAndCityTrieFinder.createTrieFinder(container);
  // const dbCtrl = await container.database.openCommonDb();
  // const rows = await dbCtrl.getCountyAndCityList();
  const rows = [{
    key: '山武郡横芝光町横芝字真砂４８２番地の２',
  }];
  rows.forEach(row => {
    const result = finder.find({
      target: CharNode.create(CountyAndCityTrieFinder.normalize(row.key)),
    });
    console.log(row.key, result);
  });

})();
