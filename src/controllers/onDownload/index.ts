// reflect-metadata is necessary for DI
import 'reflect-metadata';

import { Database } from 'better-sqlite3';
import fs from 'fs';
import path from 'node:path';
import { Logger } from 'winston';
import { AbrgMessage, saveKeyAndValue } from '../../domain';
import { DI_TOKEN, setupContainer } from '../../interface-adapter';
import { downloadProcess } from './downloadProcess';
import { extractDatasetProcess } from './extractDatasetProcess';
import { loadDatasetHistory } from './loadDatasetHistory';
import { loadDatasetProcess } from './loadDatasetProcess';

export enum ON_DOWNLOAD_RESULT {
  UPDATED = 0,
  NO_UPDATE_IS_AVAILABLE = 1,
  CAN_NOT_ACCESS_TO_DATASET_ERROR = -1,
}
export const onDownload = async ({
  ckanId,
  dataDir,
}: {
  ckanId: string;
  dataDir: string;
}): Promise<ON_DOWNLOAD_RESULT> => {
  const container = await setupContainer({
    dataDir,
    ckanId,
  });

  const logger = container.resolve<Logger | undefined>(DI_TOKEN.LOGGER);

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
    return ON_DOWNLOAD_RESULT.CAN_NOT_ACCESS_TO_DATASET_ERROR;
  }

  const db = container.resolve<Database>(DI_TOKEN.DATABASE);
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
    return ON_DOWNLOAD_RESULT.NO_UPDATE_IS_AVAILABLE;
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
  });

  db.close();

  // 展開したzipファイルのディレクトリを削除
  await fs.promises.rm(extractDir, { recursive: true });

  return ON_DOWNLOAD_RESULT.UPDATED;
};
