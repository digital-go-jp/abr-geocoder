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
// reflect-metadata is necessary for DI
import 'reflect-metadata';

import { AbrgMessage } from '@abrg-message/abrg-message';
import { setupContainer } from '@interface-adapter/setup-container';
import { DI_TOKEN } from '@interface-adapter/tokens';
import { CkanDownloader } from '@usecase/ckan-downloader/ckan-downloader';
import { Database } from 'better-sqlite3';

import { Logger } from 'winston';
import { UPDATE_CHECK_RESULT } from './update-check-result';

export const updateCheck = async ({
  ckanId,
  dataDir,
}: {
  ckanId: string;
  dataDir: string;
}): Promise<UPDATE_CHECK_RESULT> => {
  const container = await setupContainer({
    dataDir,
    ckanId,
  });

  const logger = container.resolve<Logger | undefined>(DI_TOKEN.LOGGER);
  const db = container.resolve<Database>(DI_TOKEN.DATABASE);
  const datasetUrl = container.resolve<string>(DI_TOKEN.DATASET_URL);
  const userAgent = container.resolve<string>(DI_TOKEN.USER_AGENT);

  const downloader = new CkanDownloader({
    db,
    userAgent,
    datasetUrl,
    ckanId,
    dstDir: '',
  });
  const isUpdateDataAvailable = await downloader.updateCheck();

  if (!isUpdateDataAvailable) {
    logger?.info(
      AbrgMessage.toString(AbrgMessage.ERROR_NO_UPDATE_IS_AVAILABLE)
    );
    return UPDATE_CHECK_RESULT.NO_UPDATE_IS_AVAILABLE;
  }
  logger?.info(AbrgMessage.toString(AbrgMessage.NEW_DATASET_IS_AVAILABLE));
  return UPDATE_CHECK_RESULT.NEW_DATASET_IS_AVAILABLE;
};
