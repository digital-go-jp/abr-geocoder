import path from 'node:path';
import { AbrGeocoderDiContainer } from "../abr-geocoder-di-container";
import { PrefTrieFinder } from "../pref-trie-finder";
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
  //   filename: 'pref_.*\\.abrg2',
  // });
  await PrefTrieFinder.createDictionaryFile(container);

  const finder = await PrefTrieFinder.createTrieFinder(container);
  // const dbCtrl = await container.database.openCommonDb();
  // const prefList = await dbCtrl.getPrefList();
  const prefList = [{pref: '長野県'}];
  prefList.forEach(pref => {
    const results = finder.find({
      target: CharNode.create(pref.pref),
    });
    console.log(`results.length = ${results.length}`);
    results.forEach(result => {
      console.log(result.unmatched?.toProcessedString(), result.info);
    });
  });

})();
