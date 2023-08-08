import { Database } from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { container } from "tsyringe";
import { Logger } from 'winston';
import { setupContainer } from '../../config/setupContainer';
import { AbrgError, AbrgErrorLevel, CkanDownloader } from '../../domain';
import { getDataDir } from '../../infrastructure';
import { createSqliteArchive } from './createSqliteArchive';
import { saveArchiveMeta } from './saveArchiveMeta';
import { unzipArchive } from './unzipArchive';
import StrResource, {MESSAGE} from '../../usecase/strResource';

export type DownloadPgmOpts = {
  dataDir: string | undefined;
  resourceId: string;
};

export const onDownloadAction = async (
  options: DownloadPgmOpts,
) => {
  const strResource = StrResource();
  const dataDir = await getDataDir(options.dataDir);
  const ckanId = options.resourceId;
  await setupContainer({
    dataDir,
    ckanId,
  });

  const logger = container.resolve<Logger>('Logger');
  const db = container.resolve<Database>('Database');
  const downloader = container.resolve<CkanDownloader>('Downloader');

  logger.info(
    strResource(MESSAGE.CHECKING_UPDATE),
  );

  const {updateAvailable, upstreamMeta} = await downloader.updateCheck({
    ckanId,
  });

  if (!updateAvailable) {
    return Promise.reject(
      new AbrgError({
        messageId: MESSAGE.ERROR_NO_UPDATE_IS_AVAILABLE,
        level: AbrgErrorLevel.INFO,
      })
    );
  }

  logger.info(
    strResource(MESSAGE.START_DOWNLOADING_NEW_DATASET),
  );
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
  logger.info(
    strResource(
      MESSAGE.EXTRACTING_THE_DATA,
    ),
  );
  const unzippedDir = await unzipArchive({
    srcZip: downloadFilePath,
    dstPath,
  });

  logger.info(
    strResource(
      MESSAGE.LOADING_INTO_DATABASE,
    ),
  );
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
