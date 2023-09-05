// reflect-metadata is necessary for DI
import 'reflect-metadata';

import { Database } from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { container } from 'tsyringe';
import { Logger } from 'winston';
import {
  AbrgError,
  AbrgErrorLevel,
  AbrgMessage,
  CkanDownloader,
} from '../../domain';

import CLIInfinityProgress from 'cli-infinity-progress';
import { MultiBar, SingleBar } from 'cli-progress';
import {
  setupContainer,
  setupContainerForTest,
  setupContainerParams,
} from '../../interface-adapter';
import { fsIterator } from './fsIterator';
import { loadDatasetProcess } from './loadDatasetProcess';

export namespace downloadDataset {
  let initialized = false;

  /**
   * DIコンテナを初期化する
   * @param params
   */
  export async function init(params: setupContainerParams) {
    if (initialized) {
      throw new Error('Already initialized');
    }
    initialized = true;
    await setupContainer(params);
  }

  /**
   * ユニットテスト用にDIコンテナを初期化する
   * @param params
   */
  export async function initForTest(params: setupContainerParams) {
    if (initialized) {
      throw new Error('Already initialized');
    }
    initialized = true;
    await setupContainerForTest(params);
  }

  export async function start({ dataDir, ckanId }: setupContainerParams) {
    if (!initialized) {
      throw new Error(
        'Must run init() or initForTest() before involving this function'
      );
    }

    const logger: Logger = container.resolve('Logger');
    const db: Database = container.resolve('Database');
    const downloadProgressBar = container.resolve<SingleBar>('ProgressBar');
    const loadingProgressBar = container.resolve<MultiBar>('MultiProgressBar');
    const downloadDir = path.join(dataDir, 'download');
    const userAgent: string = container.resolve('USER_AGENT');
    const getDatasetUrl: (ckanId: string) => string =
      container.resolve('getDatasetUrl');

    if (!fs.existsSync(downloadDir)) {
      await fs.promises.mkdir(downloadDir);
    }

    const getLastDatasetModified = async (): Promise<string | undefined> => {
      const result = db
        .prepare(
          "select value from metadata where key = 'last_modified' limit 1"
        )
        .get() as
        | {
            value: string;
          }
        | undefined;
      return result?.value;
    };

    // ダウンローダのインスタンスを作成
    const downloader = new CkanDownloader({
      ckanId,
      userAgent,
      getDatasetUrl,
      getLastDatasetModified,
    });

    // --------------------------------------
    // データの更新を確認する
    // --------------------------------------
    logger.info(AbrgMessage.toString(AbrgMessage.CHECKING_UPDATE));
    const { updateAvailable } = await downloader.updateCheck();

    // 更新データがなければ終了
    if (!updateAvailable) {
      return Promise.reject(
        new AbrgError({
          messageId: AbrgMessage.ERROR_NO_UPDATE_IS_AVAILABLE,
          level: AbrgErrorLevel.INFO,
        })
      );
    }

    // --------------------------------------
    // 最新データセットをダウンロードする
    // --------------------------------------
    logger.info(
      AbrgMessage.toString(AbrgMessage.START_DOWNLOADING_NEW_DATASET)
    );

    const downloadedFilePath = await downloader.download({
      progressBar: downloadProgressBar,
      downloadDir,
    });

    // --------------------------------------
    // ダウンロードしたzipファイルを全展開する
    // --------------------------------------
    logger.info(AbrgMessage.toString(AbrgMessage.EXTRACTING_THE_DATA));

    const tmpDir = await fs.promises.mkdtemp(path.dirname(downloadedFilePath));
    const fileLoadingProgress = new CLIInfinityProgress();
    fileLoadingProgress.setHeader('Finding dataset files...');
    fileLoadingProgress.start();
    const csvFiles = await fsIterator(
      tmpDir,
      downloadDir,
      '.csv',
      fileLoadingProgress
    );
    fileLoadingProgress.remove();

    // 各データセットのzipファイルを展開して、Databaseに登録する
    logger.info(AbrgMessage.toString(AbrgMessage.LOADING_INTO_DATABASE));
    await loadDatasetProcess({
      db,
      csvFiles,
      multiProgressBar: loadingProgressBar,
    });

    // 更新情報を保存する
    // saveArchiveMeta({
    //   db,
    //   meta: upstreamMeta,
    // })ß

    db.close();

    // 展開したzipファイルのディレクトリを削除
    await fs.promises.rm(tmpDir, { recursive: true });
  }
}
/*
 * CLIからのエントリーポイント
 */
export const onDownloadAction = async (params: setupContainerParams) => {
  await downloadDataset.init(params);
  await downloadDataset.start(params);
};
