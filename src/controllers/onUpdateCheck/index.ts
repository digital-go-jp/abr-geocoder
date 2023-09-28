import { DependencyContainer } from 'tsyringe';
import { CkanDownloader } from '../../usecase';
import { Database } from 'better-sqlite3';
import { AbrgMessage } from '../../domain';
import { Logger } from 'winston';
import { DI_TOKEN } from '../../interface-adapter';

export const onUpdateCheck = async ({
  container,
  ckanId,
}: {
  container: DependencyContainer;
  ckanId: string;
}) => {
  const logger = container.resolve<Logger | undefined>(DI_TOKEN.LOGGER);
  const downloader = new CkanDownloader({
    db: container.resolve<Database>(DI_TOKEN.DATABASE),
    userAgent: container.resolve<string>(DI_TOKEN.USER_AGENT),
    datasetUrl: container.resolve<string>(DI_TOKEN.DATASET_URL),
    ckanId,
    dstDir: '',
  });
  const isUpdateDataAvailable = await downloader.updateCheck();

  if (!isUpdateDataAvailable) {
    logger?.info(
      AbrgMessage.toString(AbrgMessage.ERROR_NO_UPDATE_IS_AVAILABLE)
    );
    return;
  }
  logger?.info(AbrgMessage.toString(AbrgMessage.NEW_DATASET_IS_AVAILABLE));
};
