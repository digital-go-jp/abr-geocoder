import path from 'node:path';
import {getDataDir} from '../../config';
import {CkanDownloader} from '../class/CkanDownloader';
import {unzipArchive} from './unzipArchive';
import {createSqliteArchive} from './createSqliteArchive';
import {saveArchiveMeta} from './saveArchiveMeta';
import fs from 'node:fs';
import {container} from "tsyringe";
import { Database } from 'better-sqlite3';
import { noralInitialize } from '../config/normal';
import { Logger } from 'winston';

export type DownloadPgmOpts = {
  data: string | undefined;
  source: string;
};

export const onDownloadAction = async (
  options: DownloadPgmOpts,
) => {

  const dataDir = await getDataDir(options.data);
  const ckanId = options.source;
  await noralInitialize({
    dataDir,
    ckanId,
  });

  const logger = container.resolve<Logger>('Logger');
  const db = container.resolve<Database>('Database');
  const downloader = container.resolve<CkanDownloader>('Downloader');

  logger.info('Checking update...');

  const {updateAvailable, upstreamMeta} = await downloader.updateCheck({
    ckanId,
  });

  if (!updateAvailable) {
    logger.info('The current dataset is the latest. No need to update');
    return;
  }

  logger.info('Start downloading the new dataset');
  const downloadFilePath = path.join(dataDir, `${ckanId}.zip`);
  const requestUrl = new URL(upstreamMeta.fileUrl);

  const result = await downloader.download({
    requestUrl,
    outputFile: downloadFilePath,
  });
  if (!result) {
    return;
  }

  // keep the main archive for future usage
  const archivePath = path.join(dataDir, `${ckanId}.zip`);
  const dstPath = path.join(
    path.dirname(archivePath),
    path.basename(archivePath, '.zip')
  );
  logger.info('Extracting the data...');
  const unzippedDir = await unzipArchive({
    srcZip: downloadFilePath,
    dstPath,
  });

  logger.info('Loading into the database...');
  await createSqliteArchive({
    db,
    inputDir: unzippedDir,
  });
  saveArchiveMeta({
    db,
    meta: upstreamMeta,
  })

  db.close();
  await fs.promises.rm(unzippedDir, {recursive: true});
};
