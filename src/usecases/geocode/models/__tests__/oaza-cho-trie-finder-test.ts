import { AbrGeocoderDiContainer } from "../abr-geocoder-di-container";
import path from 'node:path';
import { CharNode } from "../trie/char-node";
import { removeFiles } from "@domain/services/remove-files";
import { OazaChoTrieFinder } from "../oaza-cho-trie-finder";

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
    filename: 'oaza-cho_.*\\.abrg2',
  });
  await OazaChoTrieFinder.createDictionaryFile(container);

  const data = await OazaChoTrieFinder.loadDataFile(container);
  if (!data) {
    throw `Can not load the data`;
  }
  const finder = new OazaChoTrieFinder(data);
  const dbCtrl = await container.database.openCommonDb();
  const rows = await dbCtrl.getOazaChomes();
  rows.forEach(row => {
    const key = [
      row.oaza_cho || '',
      row.chome || '',
      row.koaza || '',
    ].join('');
    
    const result = finder.find({
      target: CharNode.create(OazaChoTrieFinder.normalize(key)),
    });
    if (result.length === 0) {
      console.log(key, result);
    }
  });

})();
