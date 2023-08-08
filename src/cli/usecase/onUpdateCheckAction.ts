import {DownloadPgmOpts} from './onDownloadAction';
import {container} from "tsyringe";
import { AbrgError, AbrgErrorLevel, CkanDownloader } from '../domain';
import StrResource, {MESSAGE} from './strResource';
import { getDataDir } from '../infrastructure';
import { Logger } from 'winston';

export const onUpdateCheckAction = async (options: DownloadPgmOpts) => {
  
  const strResource = StrResource();
  const dataDir = await getDataDir(options.dataDir);
  const ckanId = options.resourceId;
  await noralInitialize({
    dataDir,
    ckanId,
  });

  const logger = container.resolve<Logger>('Logger');
  const downloader = container.resolve(CkanDownloader);
  const {updateAvailable} = await downloader.updateCheck({
    ckanId,
  });

  if (!updateAvailable) {
    return Promise.reject(
      new AbrgError({
        messageId: MESSAGE.ERROR_NO_UPDATE_IS_AVAILABLE,
        level: AbrgErrorLevel.INFO,
      }),
    );
  }
  logger.info(
    strResource(
      MESSAGE.NEW_DATASET_IS_AVAILABLE,
    ),
  );

  console.log(
    ''
  );
};
function noralInitialize(arg0: { dataDir: any; ckanId: string; }) {
  throw new Error('Function not implemented.');
}

