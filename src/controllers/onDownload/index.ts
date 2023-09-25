// reflect-metadata is necessary for DI
import 'reflect-metadata';

import fs from 'node:fs';
import { DependencyContainer } from 'tsyringe';
import { Logger } from 'winston';
import { AbrgMessage } from '../../domain';
import { downloadProcess } from './downloadProcess';
import { extractDatasetProcess } from './extractDatasetProcess';
import { loadDatasetProcess } from './loadDatasetProcess';
import { Database } from 'better-sqlite3';
import path from 'node:path';

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

  const downloadedFilePath = await downloadProcess({
    container,
    ckanId,
    dstDir: downloadDir,
  });
  
  if (!downloadedFilePath) {
    return;
  }

  // --------------------------------------
  // ダウンロードしたzipファイルを全展開する
  // --------------------------------------
  logger?.info(AbrgMessage.toString(AbrgMessage.EXTRACTING_THE_DATA));

  const extractDir = await fs.promises.mkdtemp(path.join(dataDir, 'dataset'));
  const csvFiles = await extractDatasetProcess({
    container,
    srcDir: downloadDir,
    dstDir: extractDir,
  });

  // 各データセットのzipファイルを展開して、Databaseに登録する
  logger?.info(AbrgMessage.toString(AbrgMessage.LOADING_INTO_DATABASE));

  const db = container.resolve<Database>('DATABASE');
  await loadDatasetProcess({
    db,
    csvFiles,
    container,
  });
  db.close();

  // 展開したzipファイルのディレクトリを削除
  await fs.promises.rm(extractDir, { recursive: true });
}