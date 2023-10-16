// reflect-metadata is necessary for DI
import 'reflect-metadata';
import { Database } from 'better-sqlite3';
import { Logger } from 'winston';
import { AbrgMessage } from '../../domain';
import { DI_TOKEN, setupContainer } from '../../interface-adapter';
import { CkanDownloader } from '../../usecase';
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
