import path from 'node:path';
import {CKAN_BASE_REGISTRY_URL} from '../ckan';
import {getDataDir} from '../config';
import {CkanDownloader} from './CkanDownloader';
import {unzipArchive} from './unzipArchive';
import {createSqliteArchive} from './createSqliteArchive';
import fs from 'node:fs';

export type DownloadPgmOpts = {
  data: string | undefined;
  source: string;
};

export const onDownloadAction = async (options: DownloadPgmOpts) => {
  console.log('download開始。。');
  const dataDir = await getDataDir(options.data);
  const ckanId = options.source;

  const sqlitePath = path.join(dataDir, `${ckanId}.sqlite`);

  const downloader = new CkanDownloader({
    ckanId,
    sqlitePath: dataDir,
    ckanBaseUrl: CKAN_BASE_REGISTRY_URL,
    userAgent: 'curl/7.81.0',
    silent: false,
  });

  const {updateAvailable, upstreamMeta} = await downloader.updateCheck();

  if (!updateAvailable) {
    return Promise.reject('現状データが最新です。更新を中断します。');
  }

  const downloadFilePath = path.join(dataDir, `${ckanId}.zip`);
  const result = await downloader.download({
    upstreamMeta,
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
    meta: upstreamMeta,
    inputDir: unzippedDir,
    outputPath: sqlitePath,
  });
  await fs.promises.rm(unzippedDir, {recursive: true});
  return Promise.resolve();
};
