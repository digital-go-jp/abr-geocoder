import { Database } from 'better-sqlite3';
import { SingleBar } from 'cli-progress';
import { DependencyContainer } from 'tsyringe';
import { CkanDownloader, CkanDownloaderEvent } from '../../usecase';
import { DatasetMetadata } from '../../domain';

export const downloadProcess = async ({
  container,
  ckanId,
  dstDir,
}: {
  ckanId: string;
  dstDir: string;
  container: DependencyContainer;
}): Promise<{
  metadata: DatasetMetadata;
  downloadFilePath: string | null;
}> => {
  const db = container.resolve<Database>('DATABASE');
  const userAgent = container.resolve<string>('USER_AGENT');
  const datasetUrl = container.resolve<string>('DATASET_URL');
  const progress = container.resolve<SingleBar | undefined>('PROGRESS_BAR');

  const downloader = new CkanDownloader({
    db,
    userAgent,
    datasetUrl,
    ckanId,
    dstDir,
  });
  const metadata = await downloader.getDatasetMetadata();

  // --------------------------------------
  // 最新データセットをダウンロードする
  // --------------------------------------
  downloader.on(
    CkanDownloaderEvent.START,
    ({ position, length }: { position: number; length: number }) => {
      progress?.start(length, position);
    }
  );
  downloader.on(CkanDownloaderEvent.DATA, (chunkSize: number) => {
    progress?.increment(chunkSize);
  });
  downloader.on(CkanDownloaderEvent.END, () => {
    progress?.stop();
  });
  return {
    metadata,
    downloadFilePath: await downloader.download(),
  };
};
