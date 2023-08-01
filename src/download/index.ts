import path from 'node:path';
import {CKAN_BASE_REGISTRY_URL} from '../ckan';
import {USER_AGENT, getDataDir} from '../config';
import {CkanDownloader} from './CkanDownloader';
import {unzipArchive} from './unzipArchive';
import {createSqliteArchive} from './createSqliteArchive';
import {saveArchiveMeta} from './saveArchiveMeta';
import fs from 'node:fs';
import { createDatabase } from '../common';

export type DownloadPgmOpts = {
  data: string | undefined;
  source: string;
};

export const onDownloadAction = async (
  options: DownloadPgmOpts,
) => {
  const dataDir = await getDataDir(options.data);
  const ckanId = options.source;

  const sqlitePath = path.join(dataDir, `${ckanId}.sqlite`);
  const schemaPath = path.join(__dirname, '../../schema.sql');
  const db = await createDatabase({
    sqlitePath,
    schemaPath,
  });

  const downloader = new CkanDownloader({
    ckanId,
    db,
    ckanBaseUrl: CKAN_BASE_REGISTRY_URL,
    userAgent: USER_AGENT,
    silent: false,
  });

  const {updateAvailable, upstreamMeta} = await downloader.updateCheck();

  if (!updateAvailable) {
    return Promise.reject('現状データが最新です。更新を中断します。');
  }

  const downloadFilePath = path.join(dataDir, `${ckanId}.zip`);
  const requestUrl = new URL(upstreamMeta.fileUrl);

  const result = await downloader.download({
    requestUrl,
    outputFile: downloadFilePath,
  });
  if (!result) {
    return Promise.reject();
  }

  // keep the main archive for future usage
  const archivePath = path.join(dataDir, `${ckanId}.zip`);
  const dstPath = path.join(
    path.dirname(archivePath),
    path.basename(archivePath, '.zip')
  );
  const unzippedDir = await unzipArchive({
    srcZip: downloadFilePath,
    dstPath,
  });

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
