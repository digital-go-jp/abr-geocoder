// reflect-metadata is necessary for DI
import 'reflect-metadata';

import { Database } from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { DependencyContainer } from 'tsyringe';
import { Logger } from 'winston';
import { AbrgMessage, saveKeyAndValue } from '../../domain';
import { downloadProcess } from './downloadProcess';
import { extractDatasetProcess } from './extractDatasetProcess';
import { loadDatasetHistory } from './loadDatasetHistory';
import { loadDatasetProcess } from './loadDatasetProcess';

export const onDownload = async ({
  ckanId,
  dataDir,
  container,
}: {
  ckanId: string;
  dataDir: string;
  container: DependencyContainer;
}) => {
  const logger = container.resolve<Logger | undefined>('LOGGER');

  const downloadDir = path.join(dataDir, 'download');
  if (!fs.existsSync(downloadDir)) {
    await fs.promises.mkdir(downloadDir);
  }

  const downloadInfo = await downloadProcess({
    container,
    ckanId,
    dstDir: downloadDir,
  });

  if (!downloadInfo?.downloadFilePath) {
    return;
  }

  const db = container.resolve<Database>('DATABASE');
  const datasetHistory = await loadDatasetHistory({
    db,
  });

  // --------------------------------------
  // ダウンロードしたzipファイルを全展開する
  // --------------------------------------
  logger?.info(AbrgMessage.toString(AbrgMessage.EXTRACTING_THE_DATA));

  const extractDir = await fs.promises.mkdtemp(path.join(dataDir, 'dataset'));
  const csvFiles = await extractDatasetProcess({
    container,
    srcFile: downloadInfo.downloadFilePath,
    dstDir: extractDir,
    datasetHistory,
  });

  if (csvFiles.length === 0) {
    logger?.info(
      AbrgMessage.toString(AbrgMessage.ERROR_NO_UPDATE_IS_AVAILABLE)
    );
    db.close();

    // 展開したzipファイルのディレクトリを削除
    await fs.promises.rm(extractDir, { recursive: true });
    return;
  }

  // 各データセットのzipファイルを展開して、Databaseに登録する
  logger?.info(AbrgMessage.toString(AbrgMessage.LOADING_INTO_DATABASE));

  await loadDatasetProcess({
    db,
    csvFiles,
    container,
  });

  saveKeyAndValue({
    db,
    key: ckanId,
    value: downloadInfo.metadata.toString(),
  })

  db.close();

  // 展開したzipファイルのディレクトリを削除
  await fs.promises.rm(extractDir, { recursive: true });
};
