import path from 'node:path';
import { AbrGeocoderDiContainer } from "../abr-geocoder-di-container";
import { PrefTrieFinder } from "../pref-trie-finder";
import { CharNode } from "../trie/char-node";
import { removeFiles } from '@domain/services/remove-files';

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
    filename: 'pref_.*\\.abrg2',
  });
  await PrefTrieFinder.createDictionaryFile(container);

  const data = await PrefTrieFinder.loadDataFile(container);
  if (!data) {
    throw `Can not load the data`;
  }
  const finder = new PrefTrieFinder(data);
  const dbCtrl = await container.database.openCommonDb();
  const prefList = await dbCtrl.getPrefList();
  // const prefList = [{'pref': '三重県'},{'pref': '神奈川県'}]
  prefList.forEach(pref => {
    const results = finder.find({
      target: CharNode.create(pref.pref),
    });
    results.forEach(result => {
      console.log(result.unmatched?.toProcessedString(), result.info);
    });
  });

})();
