import { JPAddressNormalizer } from './JPAddressNormalizer';
import { OutputFormat } from './OutputFormat';
import { container } from "tsyringe";
import { Logger } from 'winston';
import byline from 'byline';
import { Database, Statement } from 'better-sqlite3';
import { SingleBar } from 'cli-progress';

export type Prefecture = {
  todofuken_name: string;
  towns: string;
};

export const onGeocodingAction = async ({
  source,
  destination,
  dataDir,
  resourceId,
  format,
  fuzzy = '?',
} : {
  source: string;
  destination: string;
  dataDir: string | undefined;
  resourceId: string;
  format: OutputFormat;
  fuzzy: string;
}) => {
  const lineStream = byline.createStream();

  const db: Database = container.resolve('Database');
  const logger: Logger = container.resolve('Logger');
  const progressBar = container.resolve<SingleBar>('DownloadProgressBar');

  const convertToHankaku =  (str: string) => {
    return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => {
      return String.fromCharCode(s.charCodeAt(0) - 0xfee0);
    });
  };

  const normalizer = new JPAddressNormalizer({
    convertToHankaku,
  });

  const prefectures = await getPrefecturesFromDB({
    db,
  });

  // getReadStreamFromSource(source)
  //   .pipe(lineStream)
  //   .pipe(normalizer)
  //   .pipe(process.stdout)
  //   .on('end', () => {
  //     db.close();
  //   })
}

const getPrefecturesFromDB = async ({
  db,
}: {
  db: Database,
}) => {
  const statement: Statement = db.prepare(`
    SELECT
      pref_name AS "todofuken_name",
      json_group_array(json_object(
        'name', country_name || city_name || od_city_name,
        'code', "code"
      )) AS "towns"
    FROM city
    GROUP BY pref_name
  `);

  const prefectures = statement.all() as Prefecture[];

}
