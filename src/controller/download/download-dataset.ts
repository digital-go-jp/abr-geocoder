// reflect-metadata is necessary for DI
import 'reflect-metadata';

import { Database } from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { Logger } from 'winston';
import { AbrgMessage, saveKeyAndValue } from '@domain';
import { DI_TOKEN, setupContainer } from '@interface-adapter';
import { downloadProcess } from './process/download-process';
import { extractDatasetProcess } from './process/extract-dataset-process';
import { loadDatasetHistory } from './process/load-dataset-history';
import { loadDatasetProcess } from './process/load-dataset-process';
import { DOWNLOAD_DATASET_RESULT } from './download-dataset-result';

export const downloadDataset = async ({
  ckanId,
  dataDir,
}: {
  ckanId: string;
  dataDir: string;
}): Promise<DOWNLOAD_DATASET_RESULT> => {
  const container = await setupContainer({
    dataDir,
    ckanId,
  });

  const logger = container.resolve<Logger | undefined>(DI_TOKEN.LOGGER);

  const downloadDir = path.join(dataDir, 'download', ckanId);
  if (!fs.existsSync(downloadDir)) {
    await fs.promises.mkdir(downloadDir);
  }

  const downloadInfo = await downloadProcess({
    container,
    ckanId,
    dstDir: downloadDir,
  });

  if (!downloadInfo?.downloadFilePath) {
    return DOWNLOAD_DATASET_RESULT.CAN_NOT_ACCESS_TO_DATASET_ERROR;
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
    return DOWNLOAD_DATASET_RESULT.NO_UPDATE_IS_AVAILABLE;
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

  return DOWNLOAD_DATASET_RESULT.SUCCESS;
};

export { DOWNLOAD_DATASET_RESULT };
