/*!
 * MIT License
 *
 * Copyright (c) 2023 デジタル庁
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { DatasetMetadata } from '@domain/dataset-metadata';
import { DI_TOKEN } from '@interface-adapter/tokens';
import {
  CkanDownloader,
  CkanDownloaderEvent,
} from '@usecase/ckan-downloader/ckan-downloader';
import { Database } from 'better-sqlite3';
import { SingleBar } from 'cli-progress';
import { DependencyContainer } from 'tsyringe';

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
  const db = container.resolve<Database>(DI_TOKEN.DATABASE);
  const userAgent = container.resolve<string>(DI_TOKEN.USER_AGENT);
  const datasetUrl = container.resolve<string>(DI_TOKEN.DATASET_URL);
  const progress = container.resolve<SingleBar | undefined>(
    DI_TOKEN.PROGRESS_BAR
  );

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
