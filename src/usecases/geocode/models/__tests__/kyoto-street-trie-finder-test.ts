import { removeFiles } from "@domain/services/remove-files";
import path from 'node:path';
import { AbrGeocoderDiContainer } from "../abr-geocoder-di-container";
import { CharNode } from "../trie/char-node";
import { KyotoStreetTrieFinder } from "../kyoto-street-trie-finder";
import { TrieFinderResult } from "../trie/common";
import { KoazaMachingInfo } from "@domain/types/geocode/koaza-info";
import { toHankakuAlphaNum } from "@usecases/geocode/services/to-hankaku-alpha-num";
import { MatchLevel } from "@domain/types/geocode/match-level";

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
    filename: 'kyoto-street_.*\\.abrg2',
  });
  await KyotoStreetTrieFinder.createDictionaryFile(container);

  const data = await KyotoStreetTrieFinder.loadDataFile(container);
  if (!data) {
    throw `Can not load the data`;
  }
  const finder = new KyotoStreetTrieFinder(data);
  const dbCtrl = await container.database.openCommonDb();
  const rows = await dbCtrl.getKyotoStreetRows();
  rows.forEach(row => {
    let results: TrieFinderResult<KoazaMachingInfo>[] = [];
    let key: string = '';
    row.oaza_cho = toHankakuAlphaNum(row.oaza_cho);
    row.chome = toHankakuAlphaNum(row.chome);
    switch (row.match_level) {
      case MatchLevel.MACHIAZA: {
        // 通り名がヒットしない場合、大字だけで検索を行う
        key = KyotoStreetTrieFinder.normalize(row.oaza_cho);
        results = finder.find({
          target: CharNode.create(key),
        });
        break;
      }

      case MatchLevel.MACHIAZA_DETAIL: {
        row.koaza = toHankakuAlphaNum(row.koaza);
        if (row.koaza_aka_code === 2) {
          // (通り名)+(大字)
          key = KyotoStreetTrieFinder.normalize(row.koaza + row.oaza_cho);
          results = finder.find({
            target: CharNode.create(key),
          });
        } else {
          // (大字)+(丁目)
          key = KyotoStreetTrieFinder.normalize(row.oaza_cho + row.chome);
          results = finder.find({
            target: CharNode.create(key),
          });
        }

        break;
      }

      default:
        // Do nothing here
        break;
    }
    if (key && results.length === 0) {
      console.log(key, results);
    }
  });

})();
