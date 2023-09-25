import { DependencyContainer } from 'tsyringe';
import { CkanDownloader } from "../../usecase";
import { Database } from 'better-sqlite3';
import { AbrgMessage } from '../../domain';
import { Logger } from "winston";

export const onUpdateCheck = async ({
  container,
  ckanId,
}: {
  container: DependencyContainer;
  ckanId: string;
}) => {

  const logger = container.resolve<Logger | undefined>('LOGGER');
  const downloader = new CkanDownloader({
    db: container.resolve<Database>('DATABASE'),
    userAgent: container.resolve<string>('USER_AGENT'),
    datasetUrl: container.resolve<string>('DATASET_URL'),
    ckanId,
    dstDir: '',
  });
  const isUpdateAvailable = await downloader.updateCheck();
  
  if (!isUpdateAvailable) {
    logger?.info(
      AbrgMessage.toString(AbrgMessage.ERROR_NO_UPDATE_IS_AVAILABLE),
    );
    return;
  }
  logger?.info(
    AbrgMessage.toString(AbrgMessage.NEW_DATASET_IS_AVAILABLE),
  );
}