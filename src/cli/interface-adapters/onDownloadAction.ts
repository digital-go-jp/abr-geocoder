// reflect-metadata is necessary for DI
import "reflect-metadata";

import { Database } from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { container } from "tsyringe";
import { Logger } from 'winston';
import {
  AbrgError,
  AbrgErrorLevel,
  AbrgMessage,
  CkanDownloader,
  CkanDownloaderEvent,
  createSqliteArchive,
  getDataDir,
  saveArchiveMeta,
  unzipArchive,
} from '../domain';

import {
  setupContainer,
  setupContainerForTest,
  setupContainerParams,
} from '../infrastructure';
import { SingleBar } from 'cli-progress';


export namespace downloadDataset {
  let initialized = false;

  export async function init(params: setupContainerParams) {
    if (initialized) {
      throw new Error('Already initialized');
    }
    initialized = true;
    await setupContainer(params);
  }

  export async function initForTest(params: setupContainerParams) {
    if (initialized) {
      throw new Error('Already initialized');
    }
    initialized = true;
    await setupContainerForTest(params);
  }

  export async function start(params: setupContainerParams) {
    if (!initialized) {
      throw new Error('Must run init() or initForTest() before involving this function');
    }

    const logger: Logger = container.resolve('Logger');
    const db: Database = container.resolve('Database');
  
  
    const progressBar = container.resolve<SingleBar>('DownloadProgressBar');
    const downloader = new CkanDownloader({
      db,
      userAgent: container.resolve('USER_AGENT'),
      getDatasetUrl: container.resolve('getDatasetUrl'),
    });
    downloader.on(CkanDownloaderEvent.START, (data: {total: number}) => {
      progressBar.start(data.total, 0);
    });
    downloader.on(CkanDownloaderEvent.PROGRESS, (data: {incrementSize: number}) => {
      progressBar.increment(data.incrementSize);
      progressBar.updateETA();
    });
    downloader.on(CkanDownloaderEvent.END, () => {
      progressBar.stop();
    });
  
    logger.info(
      AbrgMessage.toString(AbrgMessage.CHECKING_UPDATE),
    );
  
    const {updateAvailable, upstreamMeta} = await downloader.updateCheck({
      ckanId: params.ckanId,
    });
  
    if (!updateAvailable) {
      return Promise.reject(
        new AbrgError({
          messageId: AbrgMessage.ERROR_NO_UPDATE_IS_AVAILABLE,
          level: AbrgErrorLevel.INFO,
        })
      );
    }
  
    logger.info(
      AbrgMessage.toString(AbrgMessage.START_DOWNLOADING_NEW_DATASET),
    );
    const downloadFilePath = path.join(params.dataDir, `${params.ckanId}.zip`);
    const requestUrl = new URL(upstreamMeta.fileUrl);
  
    const result = await downloader.download({
      requestUrl,
      outputFile: downloadFilePath,
    });
    if (!result) {
      return;
    }
  
    // keep the main archive for future usage
    const archivePath = path.join(params.dataDir, `${params.ckanId}.zip`);
    const dstPath = path.join(
      path.dirname(archivePath),
      path.basename(archivePath, '.zip')
    );
    logger.info(
      AbrgMessage.toString(
        AbrgMessage.EXTRACTING_THE_DATA,
      ),
    );
    const unzippedDir = await unzipArchive({
      srcZip: downloadFilePath,
      dstPath,
    });
  
    logger.info(
      AbrgMessage.toString(
        AbrgMessage.LOADING_INTO_DATABASE,
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
  }
}

export const onDownloadAction = async (
  params: setupContainerParams,
) => {
  const dataDir = await getDataDir(params.dataDir);
  const ckanId = params.ckanId;
  await downloadDataset.init(params);
  await downloadDataset.start(params);
};
