import { Database } from "better-sqlite3";
import { SingleBar } from "cli-progress";
import { DependencyContainer } from "tsyringe";
import { Logger } from "winston";
import { AbrgMessage } from "../../domain";
import { CkanDownloader } from "../../usecase";

export const downloadProcess = async ({
  container,
  ckanId,
  dstDir,
}: {
  ckanId: string;
  dstDir: string;
  container: DependencyContainer;
}): Promise<string | null> => {
  const db = container.resolve<Database>('DATABASE');
  const userAgent = container.resolve<string>('USER_AGENT');
  const datasetUrl = container.resolve<string>('DATASET_URL');
  const progress = container.resolve<SingleBar | undefined>('PROGRESS_BAR');
  const logger = container.resolve<Logger | undefined>('LOGGER');

  const downloader = new CkanDownloader({
    db,
    userAgent,
    datasetUrl,
    ckanId,
    dstDir,
  });

  // --------------------------------------
  // データの更新を確認する
  // --------------------------------------
  const isUpdateAvailable = await downloader.updateCheck();
  if (!isUpdateAvailable) {
    logger?.info(
      AbrgMessage.toString(AbrgMessage.ERROR_NO_UPDATE_IS_AVAILABLE),
    );
    return null;
  }

  // --------------------------------------
  // 最新データセットをダウンロードする
  // --------------------------------------
  downloader.on('download:start', ({
    position,
    length,
  }: {
    position: number,
    length: number,
  }) => {
    progress?.start(length, position);
  });
  downloader.on('download:data', (chunkSize: number) => {
    progress?.increment(chunkSize);
  })
  downloader.on('download:end', () => {
    progress?.stop();
  })
  return await downloader.download();
}